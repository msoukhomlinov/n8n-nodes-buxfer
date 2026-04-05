/**
 * Buxfer AI Tools node — exposes Buxfer resources as AI Agent / MCP tools.
 *
 * Architecture: single unified DynamicStructuredTool per resource.
 * Dual-path dispatch: supplyData() → func() (MCP/Agent V2) + execute() (Agent V3).
 */
import type {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	IExecuteFunctions,
	INodeExecutionData,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type { DynamicStructuredTool } from '@langchain/core/tools';

import { RuntimeDynamicStructuredTool, runtimeZod } from './ai-tools/runtime.js';
import { getRuntimeSchemaBuilders, RESOURCE_OPERATIONS, WRITE_OPERATIONS } from './ai-tools/schema-generator.js';
import {
	buildUnifiedDescription,
	buildListAccountsDescription,
	buildListTagsDescription,
} from './ai-tools/description-builders.js';
import { executeAiTool } from './ai-tools/tool-executor.js';
import { wrapError, ERROR_TYPES } from './ai-tools/error-formatter.js';
import { buxferApiRequest } from './api.js';

// ---------------------------------------------------------------------------
// Runtime schema builders (resolved once at module level)
// ---------------------------------------------------------------------------
const { buildUnifiedSchema } = getRuntimeSchemaBuilders(runtimeZod);

// ---------------------------------------------------------------------------
// MCP annotations lookup
// ---------------------------------------------------------------------------
const MCP_ANNOTATIONS_BY_OPERATION: Record<
	string,
	{ readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }
> = {
	getAll: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
	create: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
	update: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
	delete: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
};

function getMcpAnnotations(operations: string[]) {
	// Conservative: if any write op is included, readOnly=false
	const hasWrite = operations.some((op) => WRITE_OPERATIONS.includes(op));
	const hasDestructive = operations.includes('delete');
	return {
		readOnlyHint: !hasWrite,
		destructiveHint: hasDestructive,
		idempotentHint: true,
		openWorldHint: true,
	};
}

// ---------------------------------------------------------------------------
// Helper: parse tool result for execute() response
// ---------------------------------------------------------------------------
function parseToolResult(jsonString: string): IDataObject {
	try {
		return JSON.parse(jsonString) as IDataObject;
	} catch {
		return { rawResponse: jsonString };
	}
}

// ---------------------------------------------------------------------------
// Node class
// ---------------------------------------------------------------------------
export class BuxferAiTools implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Buxfer AI Tools',
		name: 'buxferAiTools',
		icon: { light: 'file:buxfer.svg', dark: 'file:buxfer.svg' },
		group: ['transform'],
		version: 1,
		description: 'Expose Buxfer resources as AI Agent / MCP tools',
		defaults: {
			name: 'Buxfer AI Tools',
		},
		// AI tool nodes have no main inputs — they connect to AI Agent tool input
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		credentials: [
			{
				name: 'buxferApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Budget', value: 'budget' },
					{ name: 'Contact', value: 'contact' },
					{ name: 'Group', value: 'group' },
					{ name: 'Loan', value: 'loan' },
					{ name: 'Reminder', value: 'reminder' },
					{ name: 'Tag', value: 'tag' },
					{ name: 'Transaction', value: 'transaction' },
				],
				default: 'transaction',
			},
			{
				displayName: 'Operations',
				name: 'operations',
				type: 'multiOptions',
				description: 'Which operations to expose to the AI agent',
				noDataExpression: true,
				options: [
					{ name: 'Get All', value: 'getAll' },
					{ name: 'Create', value: 'create' },
					{ name: 'Update', value: 'update' },
					{ name: 'Delete', value: 'delete' },
				],
				default: ['getAll'],
				displayOptions: {
					show: {
						resource: ['transaction'],
					},
				},
			},
			{
				displayName: 'Allow Write Operations',
				name: 'allowWriteOperations',
				type: 'boolean',
				default: false,
				description:
					'Whether to allow create, update, and delete operations. When disabled, only read operations are available.',
				displayOptions: {
					show: {
						resource: ['transaction'],
					},
				},
			},
		],
	};

	// -----------------------------------------------------------------------
	// supplyData() — MCP Trigger / Agent V2 path
	// -----------------------------------------------------------------------
	async supplyData(this: ISupplyDataFunctions): Promise<SupplyData> {
		const resource = this.getNodeParameter('resource', 0) as string;
		const config = RESOURCE_OPERATIONS[resource];
		if (!config) {
			throw new NodeOperationError(
				this.getNode(),
				`Unknown resource: ${resource}`,
			);
		}

		// Determine effective operations
		let selectedOps: string[];
		if (resource === 'transaction') {
			selectedOps = this.getNodeParameter('operations', 0) as string[];
		} else {
			selectedOps = config.ops;
		}

		// Layer 1: Filter write operations if not allowed
		const allowWriteOperations =
			resource === 'transaction'
				? (this.getNodeParameter('allowWriteOperations', 0, false) as boolean)
				: false;

		const effectiveOps = allowWriteOperations
			? selectedOps
			: selectedOps.filter((op) => !WRITE_OPERATIONS.includes(op));

		if (effectiveOps.length === 0) {
			throw new NodeOperationError(
				this.getNode(),
				'No operations selected or all selected operations are write operations that are currently disabled.',
			);
		}

		// Build schema and description from effective operations only
		const schema = buildUnifiedSchema(resource, effectiveOps);
		const description = buildUnifiedDescription(resource, effectiveOps);

		// Tool name: buxfer_{resource} — complies with MCP regex ^[a-zA-Z0-9_-]{1,128}$
		const toolName = `buxfer_${resource}`;
		const annotations = getMcpAnnotations(effectiveOps);

		const context = this;

		const unifiedTool = new RuntimeDynamicStructuredTool({
			name: toolName,
			description,
			schema: schema as any,
			metadata: { annotations },
			func: async (params: Record<string, unknown>): Promise<string> => {
				const operation = params.operation as string;

				// Layer 2: Re-check write safety in func()
				if (operation && WRITE_OPERATIONS.includes(operation) && !allowWriteOperations) {
					return JSON.stringify(
						wrapError(
							resource,
							operation,
							ERROR_TYPES.WRITE_OPERATION_BLOCKED,
							'Write operations are disabled.',
							'Enable allowWriteOperations on this node to use mutating operations.',
						),
					);
				}

				// Validate operation
				if (!effectiveOps.includes(operation)) {
					return JSON.stringify(
						wrapError(
							resource,
							operation,
							ERROR_TYPES.INVALID_OPERATION,
							`Operation '${operation}' is not available.`,
							`Available operations: ${effectiveOps.join(', ')}.`,
						),
					);
				}

				// Strip operation from params before passing to executor
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { operation: _op, ...rest } = params;
				return executeAiTool(context, resource, operation, rest);
			},
		}) as unknown as DynamicStructuredTool;

		// Build discovery helper tools
		const helperTools: DynamicStructuredTool[] = [];

		const listAccountsTool = new RuntimeDynamicStructuredTool({
			name: 'buxfer_listAccounts',
			description: buildListAccountsDescription(),
			schema: runtimeZod.object({}) as any,
			metadata: {
				annotations: MCP_ANNOTATIONS_BY_OPERATION.getAll,
			},
			func: async (): Promise<string> => {
				try {
					const response = await buxferApiRequest(context as any, 'GET', '/accounts');
					const accounts = response?.response?.accounts || [];
					return JSON.stringify(
						accounts.map((a: any) => ({ id: a.id, name: a.name })),
					);
				} catch (error) {
					return JSON.stringify({
						error: (error as Error).message,
						nextAction: 'Check credentials and retry.',
					});
				}
			},
		}) as unknown as DynamicStructuredTool;
		helperTools.push(listAccountsTool);

		const listTagsTool = new RuntimeDynamicStructuredTool({
			name: 'buxfer_listTags',
			description: buildListTagsDescription(),
			schema: runtimeZod.object({}) as any,
			metadata: {
				annotations: MCP_ANNOTATIONS_BY_OPERATION.getAll,
			},
			func: async (): Promise<string> => {
				try {
					const response = await buxferApiRequest(context as any, 'GET', '/tags');
					const tags = response?.response?.tags || [];
					return JSON.stringify(
						tags.map((t: any) => ({ id: t.id, name: t.name })),
					);
				} catch (error) {
					return JSON.stringify({
						error: (error as Error).message,
						nextAction: 'Check credentials and retry.',
					});
				}
			},
		}) as unknown as DynamicStructuredTool;
		helperTools.push(listTagsTool);

		return {
			response: [unifiedTool, ...helperTools],
		};
	}

	// -----------------------------------------------------------------------
	// execute() — Agent V3 (EngineRequest) path
	// -----------------------------------------------------------------------
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const resource = this.getNodeParameter('resource', 0) as string;
		const config = RESOURCE_OPERATIONS[resource];

		// Determine effective operations (same logic as supplyData)
		let selectedOps: string[];
		if (resource === 'transaction') {
			selectedOps = this.getNodeParameter('operations', 0) as string[];
		} else {
			selectedOps = config?.ops ?? ['getAll'];
		}

		const allowWriteOperations =
			resource === 'transaction'
				? (this.getNodeParameter('allowWriteOperations', 0, false) as boolean)
				: false;

		const effectiveOps = allowWriteOperations
			? selectedOps
			: selectedOps.filter((op) => !WRITE_OPERATIONS.includes(op));

		// Helper operations are always allowed in execute() path
		const allAllowedOps = [...effectiveOps];

		const response: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item = items[itemIndex]!;
			const json = item.json as Record<string, unknown>;

			// Detect tool call: check for operation (n8n 2.14+) or tool (older)
			const requestedOp = (json.operation as string) || (json.tool as string) || undefined;

			if (!requestedOp) {
				// Editor "Test step" — return stub message
				response.push({
					json: {
						message: `Buxfer AI Tools node is configured for resource '${resource}' with operations: ${effectiveOps.join(', ')}. Connect this node to an AI Agent to use it as a tool.`,
					},
					pairedItem: { item: itemIndex },
				});
				continue;
			}

			// Layer 3: Re-check write safety in execute()
			if (WRITE_OPERATIONS.includes(requestedOp) && !allowWriteOperations) {
				response.push({
					json: parseToolResult(
						JSON.stringify(
							wrapError(
								resource,
								requestedOp,
								ERROR_TYPES.WRITE_OPERATION_BLOCKED,
								'Write operations are disabled.',
								'Enable allowWriteOperations on this node to use mutating operations.',
							),
						),
					),
					pairedItem: { item: itemIndex },
				});
				continue;
			}

			// Validate operation
			if (!allAllowedOps.includes(requestedOp)) {
				response.push({
					json: parseToolResult(
						JSON.stringify(
							wrapError(
								resource,
								requestedOp,
								ERROR_TYPES.INVALID_OPERATION,
								`Operation '${requestedOp}' is not available.`,
								`Available operations: ${effectiveOps.join(', ')}.`,
							),
						),
					),
					pairedItem: { item: itemIndex },
				});
				continue;
			}

			// Execute the tool
			const resultStr = await executeAiTool(this, resource, requestedOp, json);
			response.push({
				json: parseToolResult(resultStr),
				pairedItem: { item: itemIndex },
			});
		}

		return [response];
	}
}
