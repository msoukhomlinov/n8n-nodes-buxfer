/**
 * Execution routing for Buxfer AI Tools.
 *
 * Called from both func() (supplyData/MCP) and execute() (Agent V3) paths.
 * All return paths use JSON.stringify(wrapSuccess/wrapError(...)).
 */
import type { IExecuteFunctions, ISupplyDataFunctions } from 'n8n-workflow';
import { buxferApiRequest } from '../api.js';
import {
	wrapSuccess,
	wrapError,
	formatApiError,
	formatMissingIdError,
	formatNoResultsFound,
	ERROR_TYPES,
} from './error-formatter.js';

// ---------------------------------------------------------------------------
// n8n metadata stripping
// ---------------------------------------------------------------------------
const N8N_METADATA_FIELDS = new Set([
	'sessionId',
	'action',
	'chatInput',
	'root',
	'tool',
	'toolName',
	'toolCallId',
	'operation',
]);

const N8N_METADATA_PREFIXES = ['Prompt__'];

function stripMetadata(params: Record<string, unknown>): Record<string, unknown> {
	const cleaned: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(params)) {
		if (N8N_METADATA_FIELDS.has(key)) continue;
		if (N8N_METADATA_PREFIXES.some((p) => key.startsWith(p))) continue;
		cleaned[key] = value;
	}
	return cleaned;
}

// ---------------------------------------------------------------------------
// Response unwrap map: resource → response key
// ---------------------------------------------------------------------------
const RESPONSE_KEYS: Record<string, string> = {
	account: 'accounts',
	budget: 'budgets',
	contact: 'contacts',
	group: 'groups',
	loan: 'loans',
	reminder: 'reminders',
	tag: 'tags',
	transaction: 'transactions',
};

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------
export async function executeAiTool(
	context: IExecuteFunctions | ISupplyDataFunctions,
	resource: string,
	operation: string,
	params: Record<string, unknown>,
): Promise<string> {
	// Strip n8n metadata at entry — before any routing
	const cleanParams = stripMetadata(params);

	try {
		switch (resource) {
			// ---------------------------------------------------------------
			// Read-only resources
			// ---------------------------------------------------------------
			case 'account':
			case 'budget':
			case 'contact':
			case 'group':
			case 'loan':
			case 'reminder':
			case 'tag': {
				if (operation !== 'getAll') {
					return JSON.stringify(
						wrapError(
							resource,
							operation,
							ERROR_TYPES.INVALID_OPERATION,
							`Operation '${operation}' is not valid for ${resource}. Only 'getAll' is supported.`,
							`Use buxfer_${resource} with operation 'getAll'.`,
						),
					);
				}
				const responseKey = RESPONSE_KEYS[resource]!;
				const response = await buxferApiRequest(
					context as any,
					'GET',
					`/${responseKey}`,
				);
				const items = response?.response?.[responseKey] || [];
				return JSON.stringify(
					wrapSuccess(resource, operation, {
						items,
						count: items.length,
					}),
				);
			}

			// ---------------------------------------------------------------
			// Transaction
			// ---------------------------------------------------------------
			case 'transaction': {
				switch (operation) {
					case 'getAll': {
						const filters: Record<string, unknown> = {};
						const hasFilters =
							cleanParams.search ||
							cleanParams.accountId ||
							cleanParams.tagName ||
							cleanParams.startDate ||
							cleanParams.endDate ||
							cleanParams.status;

						if (cleanParams.accountId) filters.accountId = cleanParams.accountId;
						if (cleanParams.tagName) filters.tagName = cleanParams.tagName;
						if (cleanParams.startDate) filters.startDate = cleanParams.startDate;
						if (cleanParams.endDate) filters.endDate = cleanParams.endDate;
						if (cleanParams.status) filters.status = cleanParams.status;

						filters.page = 1;
						const response = await buxferApiRequest(
							context as any,
							'GET',
							'/transactions',
							filters,
						);
						let transactions: any[] =
							response?.response?.transactions || [];

						// Client-side search filter (Buxfer API doesn't support text search)
						if (cleanParams.search && typeof cleanParams.search === 'string') {
							const term = cleanParams.search.toLowerCase();
							transactions = transactions.filter((t: any) => {
								const desc = (t.description || '').toLowerCase();
								const extra = (t.extraInfo || '').toLowerCase();
								return desc.includes(term) || extra.includes(term);
							});
						}

						// Apply limit
						const limit =
							typeof cleanParams.limit === 'number'
								? cleanParams.limit
								: 25;
						const truncated = transactions.length > limit;
						if (truncated) {
							transactions = transactions.slice(0, limit);
						}

						// Filtered empty guard
						if (hasFilters && transactions.length === 0) {
							return JSON.stringify(
								formatNoResultsFound(resource, operation, cleanParams),
							);
						}

						return JSON.stringify(
							wrapSuccess(resource, operation, {
								items: transactions,
								count: transactions.length,
								...(truncated ? { truncated: true } : {}),
							}),
						);
					}

					case 'create': {
						const data: Record<string, unknown> = {};

						// Required fields
						if (!cleanParams.description)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'description is required.', 'Provide the description field.'),
							);
						if (cleanParams.amount === undefined)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'amount is required.', 'Provide the amount field.'),
							);
						if (!cleanParams.date)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'date is required (YYYY-MM-DD).', 'Provide the date field.'),
							);
						if (!cleanParams.accountId)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'accountId is required.', 'Use buxfer_listAccounts to find the correct account ID.'),
							);
						if (!cleanParams.type)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'type is required.', 'Provide type: expense, income, transfer, sharedBill, loan, or paidForFriend.'),
							);
						if (!cleanParams.status)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'status is required.', 'Provide status: cleared or pending.'),
							);

						data.description = cleanParams.description;
						data.amount = cleanParams.amount;
						data.date = cleanParams.date;
						data.accountId = cleanParams.accountId;
						data.type = cleanParams.type;
						data.status = cleanParams.status;

						// Optional fields
						if (cleanParams.tags) data.tags = cleanParams.tags;
						if (cleanParams.payers) data.payers = cleanParams.payers;
						if (cleanParams.sharers) data.sharers = cleanParams.sharers;
						if (cleanParams.isEvenSplit !== undefined)
							data.isEvenSplit = cleanParams.isEvenSplit;
						if (cleanParams.loanedBy) data.loanedBy = cleanParams.loanedBy;
						if (cleanParams.borrowedBy) data.borrowedBy = cleanParams.borrowedBy;
						if (cleanParams.paidBy) data.paidBy = cleanParams.paidBy;
						if (cleanParams.paidFor) data.paidFor = cleanParams.paidFor;

						const result = await buxferApiRequest(
							context as any,
							'POST',
							'/transaction_add',
							data,
						);
						const created = result?.response || {};
						return JSON.stringify(
							wrapSuccess(resource, operation, created),
						);
					}

					case 'update': {
						if (!cleanParams.id) {
							return JSON.stringify(formatMissingIdError(resource, operation));
						}

						const data: Record<string, unknown> = {
							id: cleanParams.id,
						};

						// Optional fields — only include what's provided
						if (cleanParams.description !== undefined)
							data.description = cleanParams.description;
						if (cleanParams.amount !== undefined)
							data.amount = cleanParams.amount;
						if (cleanParams.date !== undefined) data.date = cleanParams.date;
						if (cleanParams.accountId !== undefined)
							data.accountId = cleanParams.accountId;
						if (cleanParams.type !== undefined) data.type = cleanParams.type;
						if (cleanParams.status !== undefined)
							data.status = cleanParams.status;
						if (cleanParams.tags !== undefined) data.tags = cleanParams.tags;
						if (cleanParams.payers) data.payers = cleanParams.payers;
						if (cleanParams.sharers) data.sharers = cleanParams.sharers;
						if (cleanParams.isEvenSplit !== undefined)
							data.isEvenSplit = cleanParams.isEvenSplit;
						if (cleanParams.loanedBy !== undefined)
							data.loanedBy = cleanParams.loanedBy;
						if (cleanParams.borrowedBy !== undefined)
							data.borrowedBy = cleanParams.borrowedBy;
						if (cleanParams.paidBy !== undefined)
							data.paidBy = cleanParams.paidBy;
						if (cleanParams.paidFor !== undefined)
							data.paidFor = cleanParams.paidFor;

						const result = await buxferApiRequest(
							context as any,
							'POST',
							'/transaction_edit',
							data,
						);
						const updated = result?.response || {};
						return JSON.stringify(
							wrapSuccess(resource, operation, updated),
						);
					}

					case 'delete': {
						if (!cleanParams.id) {
							return JSON.stringify(formatMissingIdError(resource, operation));
						}

						await buxferApiRequest(context as any, 'POST', '/transaction_delete', {
							id: cleanParams.id,
						});
						return JSON.stringify(
							wrapSuccess(resource, operation, {
								id: cleanParams.id,
								deleted: true,
							}),
						);
					}

					default:
						return JSON.stringify(
							wrapError(
								resource,
								operation,
								ERROR_TYPES.INVALID_OPERATION,
								`Unknown operation '${operation}' for transaction.`,
								`Valid operations: getAll, create, update, delete.`,
							),
						);
				}
			}

			default:
				return JSON.stringify(
					wrapError(
						resource,
						operation,
						ERROR_TYPES.INVALID_OPERATION,
						`Unknown resource '${resource}'.`,
						'Valid resources: account, budget, contact, group, loan, reminder, tag, transaction.',
					),
				);
		}
	} catch (error) {
		// Distinguish programming errors from API errors
		if (
			error instanceof TypeError ||
			error instanceof ReferenceError ||
			error instanceof RangeError
		) {
			return JSON.stringify(
				wrapError(
					resource,
					operation,
					ERROR_TYPES.INTERNAL_ERROR,
					(error as Error).message,
					'This appears to be a bug in the tool. Do not retry with the same parameters.',
				),
			);
		}

		return JSON.stringify(
			formatApiError(resource, operation, (error as Error).message),
		);
	}
}
