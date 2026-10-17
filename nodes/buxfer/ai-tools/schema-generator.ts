/**
 * Zod schemas for Buxfer AI Tools — one unified schema per resource.
 *
 * Compile-time `z` is a VALUE import (needed for z.object() etc).
 * Runtime schemas are built via getRuntimeSchemaBuilders(runtimeZod).
 */
import { z } from 'zod';
import type { z as zodNamespace } from 'zod';
import type { ToolNames } from './tool-naming.js';

// ---------------------------------------------------------------------------
// Constants — shared enums
// ---------------------------------------------------------------------------
export const TRANSACTION_TYPES = [
	'expense',
	'income',
	'transfer',
	'sharedBill',
	'loan',
	'paidForFriend',
] as const;

export const TRANSACTION_STATUSES = ['cleared', 'pending'] as const;
export const TRANSACTION_FILTER_STATUSES = ['cleared', 'pending', 'reconciled'] as const;

// ---------------------------------------------------------------------------
// Resource → Operations config
// ---------------------------------------------------------------------------
export interface ResourceConfig {
	ops: string[];
}

export const RESOURCE_OPERATIONS: Record<string, ResourceConfig> = {
	account: { ops: ['getAll'] },
	budget: { ops: ['getAll'] },
	contact: { ops: ['getAll'] },
	group: { ops: ['getAll'] },
	loan: { ops: ['getAll'] },
	reminder: { ops: ['getAll'] },
	tag: { ops: ['getAll'] },
	transaction: { ops: ['getAll', 'create', 'update', 'delete', 'aggregate'] },
};

export const WRITE_OPERATIONS = ['create', 'update', 'delete'];

// ---------------------------------------------------------------------------
// Per-operation schemas (compile-time z — for type checking & template)
// ---------------------------------------------------------------------------

// -- Transaction schemas --
function getTransactionGetAllSchema(names: ToolNames) {
	return z.object({
		operation: z.literal('getAll').describe("List/search transactions."),
		search: z.string().optional().describe(
			'ALWAYS use this for text lookups. Case-insensitive partial match on transaction descriptions and tag names (applied client-side, so it scans up to the 2000 most recent transactions of the window — narrow the date range or add accountId for deeper history). Combine with startDate/endDate to bound the window, e.g. "last 30 days".',
		),
		fuzzy: z.boolean().optional().describe(
			'Fuzzy (near-word) search behavior. Default: exact matches only — but if the exact search finds nothing, fuzzy rescue runs automatically and is flagged in coverage (fuzzyFallback). Set true to include near-word matches alongside exact ones; set false to disable fuzzy entirely.',
		),
		accountId: z.number().optional().describe(
			`Filter by account ID (use ${names.listAccounts} to find IDs).`,
		),
		tagName: z.string().optional().describe(
			`Filter by tag name (server-side, resolved to a tag ID). Use exact names from ${names.listTags}, e.g. 'Food / Grocery'. A parent tag (e.g. 'Health') also matches its child tags (Buxfer's tag filter is hierarchical).`,
		),
		type: z.enum(TRANSACTION_TYPES).optional().describe(
			'Only include transactions of this type. Use type: "expense" for "how much did I SPEND" questions so transfers and income are excluded.',
		),
		startDate: z.string().optional().describe(
			'Start date for date range filter (YYYY-MM-DD format).',
		),
		endDate: z.string().optional().describe(
			'End date for date range filter (YYYY-MM-DD format).',
		),
		status: z.enum(TRANSACTION_FILTER_STATUSES).optional().describe(
			'Filter by status: cleared = confirmed, pending = unconfirmed, reconciled = bank-matched.',
		),
		limit: z.number().optional().describe(
			'Max results to return (default 25). Increase to 100 if you expect many.',
		),
	});
}

function getTransactionCreateSchema(names: ToolNames) {
	return z.object({
		operation: z.literal('create').describe('Create a new transaction.'),
		description: z.string().describe('Transaction description/memo (required).'),
		amount: z.number().describe('Transaction amount (required). Positive number.'),
		date: z.string().describe('Transaction date in YYYY-MM-DD format (required).'),
		accountId: z.number().describe(
			`Account ID (required). Use ${names.listAccounts} to find the correct ID.`,
		),
		type: z.enum(TRANSACTION_TYPES).describe(
			'Transaction type (required): expense = outgoing, income = incoming, transfer = between accounts, sharedBill = split cost, loan = money lent/borrowed, paidForFriend = paid on behalf.',
		),
		status: z.enum(TRANSACTION_STATUSES).describe(
			'Transaction status (required): cleared = confirmed, pending = unconfirmed.',
		),
		tags: z.string().optional().describe(
			`Comma-separated tag names (e.g. "Food,Transport"). Use ${names.listTags} to discover valid names.`,
		),
		payers: z.array(z.record(z.unknown())).optional().describe(
			'For sharedBill type only. Array of {contactId, amount} objects.',
		),
		sharers: z.array(z.record(z.unknown())).optional().describe(
			'For sharedBill type only. Array of {contactId, amount} objects.',
		),
		isEvenSplit: z.boolean().optional().describe(
			'For sharedBill type only. Whether to split evenly among sharers.',
		),
		loanedBy: z.string().optional().describe('For loan type only. Contact who loaned money.'),
		borrowedBy: z.string().optional().describe('For loan type only. Contact who borrowed money.'),
		paidBy: z.string().optional().describe('For paidForFriend type only. Contact who paid.'),
		paidFor: z.string().optional().describe('For paidForFriend type only. Contact paid for.'),
	});
}

function getTransactionUpdateSchema(names: ToolNames) {
	return z.object({
		operation: z.literal('update').describe('Update an existing transaction.'),
		id: z.number().describe(
			`Transaction ID (required). Use ${names.main} with operation getAll to find IDs.`,
		),
		description: z.string().optional().describe('Updated description/memo.'),
		amount: z.number().optional().describe('Updated amount.'),
		date: z.string().optional().describe('Updated date in YYYY-MM-DD format.'),
		accountId: z.number().optional().describe(
			`Updated account ID. Use ${names.listAccounts} to find IDs.`,
		),
		type: z.enum(TRANSACTION_TYPES).optional().describe('Updated transaction type.'),
		status: z.enum(TRANSACTION_STATUSES).optional().describe('Updated status.'),
		tags: z.string().optional().describe(
			`Updated comma-separated tag names. Use ${names.listTags} to discover valid names.`,
		),
		payers: z.array(z.record(z.unknown())).optional().describe('For sharedBill type only.'),
		sharers: z.array(z.record(z.unknown())).optional().describe('For sharedBill type only.'),
		isEvenSplit: z.boolean().optional().describe('For sharedBill type only.'),
		loanedBy: z.string().optional().describe('For loan type only.'),
		borrowedBy: z.string().optional().describe('For loan type only.'),
		paidBy: z.string().optional().describe('For paidForFriend type only.'),
		paidFor: z.string().optional().describe('For paidForFriend type only.'),
	});
}

function getTransactionDeleteSchema(names: ToolNames) {
	return z.object({
		operation: z.literal('delete').describe('Delete a transaction.'),
		id: z.number().describe(
			`Transaction ID (required). Use ${names.main} with operation getAll to find IDs.`,
		),
	});
}

function getTransactionAggregateSchema(names: ToolNames) {
	return z.object({
		operation: z
			.literal('aggregate')
			.describe('Compute spending totals (grouped sums) without fetching raw transaction lists.'),
		groupBy: z
			.enum(['tag', 'account', 'type', 'day', 'week', 'month'])
			.optional()
			.describe(
				'Group totals by this key. Omit for one grand total. tag = by tag name, account = by account name, type = expense/income/transfer, day/week/month = calendar period of the transaction date.',
			),
		search: z.string().optional().describe(
			'Only total transactions matching this text (same semantics as getAll: exact match, with automatic fuzzy rescue when exact finds nothing).',
		),
		fuzzy: z.boolean().optional().describe(
			'Fuzzy (near-word) behavior, same semantics as getAll. Default: exact only, with automatic fuzzy rescue when exact finds nothing. true = include near-word matches alongside exact; false = exact only, no rescue.',
		),
		startDate: z.string().optional().describe(
			'Start date for date range filter (YYYY-MM-DD format).',
		),
		endDate: z.string().optional().describe(
			'End date for date range filter (YYYY-MM-DD format).',
		),
		accountId: z.number().optional().describe(
			`Filter by account ID (use ${names.listAccounts} to find IDs).`,
		),
		tagName: z.string().optional().describe(
			`Filter by tag name (use ${names.listTags} to discover valid tag names). A parent tag also matches its child tags.`,
		),
		type: z.enum(TRANSACTION_TYPES).optional().describe(
			'Only total transactions of this type. Use type: "expense" for "how much did I SPEND" questions so transfers and income are excluded.',
		),
		topN: z.number().optional().describe(
			'How many of the largest transactions to include: per group when groupBy is set (default 3); when groupBy is omitted, the top N largest transactions across the whole window.'
		),
	});
}

// ---------------------------------------------------------------------------
// Runtime field cloning
// ---------------------------------------------------------------------------

/**
 * Rebuild a field schema using the runtime zod copy.
 *
 * Per-operation shapes are built with this package's compile-time zod, which
 * may be a different module copy than the runtime zod n8n resolves. Passing a
 * cross-copy field object into the runtime `z.object()` makes
 * zod-to-json-schema treat it as a plain JSON value (garbage schema). Cloning
 * from the field's `_def` type keeps the real JSON types (string, number,
 * boolean, enum, array) — the LLM needs the types to emit valid arguments.
 * Both zod v3 (`ZodString`…) and v4 (`string`…) def type names are handled.
 */
function cloneFieldForRuntime(runtimeZ: typeof zodNamespace, fieldSchema: z.ZodTypeAny): z.ZodTypeAny {
	const def = (fieldSchema as any)?._def;
	// Older zod v3 exposes `def.type` ('string'…), zod ≥ 3.25 / v4 expose
	// `def.typeName` ('ZodString'…). Accept both. Unwrap ZodOptional first —
	// the merged schema re-applies `.optional()` itself.
	const unwrapped = (d: any) => d?._def ?? d?.def ?? d;
	const innerDef =
		def && (def.typeName === 'ZodOptional' || def.type === 'optional')
			? unwrapped(def.innerType)
			: def;
	// NOTE: in zod ≥ 3.25 hybrid, `def.type` on a ZodArray is the ELEMENT
	// schema (an object), not a tag — so only trust `def.type` when it is a
	// string; prefer the string `def.typeName` when present.
	const t =
		typeof innerDef?.typeName === 'string'
			? innerDef.typeName
			: typeof innerDef?.type === 'string'
				? innerDef.type
				: undefined;
	if (t === 'ZodString' || t === 'string') return runtimeZ.string();
	if (t === 'ZodNumber' || t === 'number') return runtimeZ.number();
	if (t === 'ZodBoolean' || t === 'boolean') return runtimeZ.boolean();
	if (t === 'ZodEnum' || t === 'enum') {
		return runtimeZ.enum(innerDef.values as [string, ...string[]]);
	}
	if (t === 'ZodArray' || t === 'array') return runtimeZ.array(runtimeZ.unknown());
	if (t === 'ZodRecord' || t === 'record') {
		return runtimeZ.record(runtimeZ.string(), runtimeZ.unknown());
	}
	return runtimeZ.unknown();
}

// ---------------------------------------------------------------------------
// Unified schema builder
// ---------------------------------------------------------------------------

function mergeSchemas(
	runtimeZ: typeof zodNamespace,
	operationValues: string[],
	schemasByOp: Record<string, z.ZodObject<any>>,
) {
	// Collect all field shapes across operations
	const allShapes: Record<string, { schema: z.ZodTypeAny; ops: string[] }> = {};

	for (const op of operationValues) {
		const opSchema = schemasByOp[op];
		if (!opSchema) continue;
		const shape = opSchema.shape;
		for (const [key, fieldSchema] of Object.entries(shape)) {
			if (key === 'operation') continue;
			if (!allShapes[key]) {
				allShapes[key] = { schema: fieldSchema as z.ZodTypeAny, ops: [] };
			}
			allShapes[key].ops.push(op);
		}
	}

	// Build merged shape with operation labels appended to descriptions
	const mergedShape: Record<string, z.ZodTypeAny> = {
		operation: runtimeZ
			.enum(operationValues as [string, ...string[]])
			.describe(`Operation to perform: ${operationValues.join(', ')}`),
	};

	for (const [key, { schema, ops }] of Object.entries(allShapes)) {
		const existingDesc = (schema as any)?._def?.description ?? '';
		const opsLabel = `[Used by: ${ops.join(', ')}]`;
		const desc = existingDesc ? `${existingDesc} ${opsLabel}` : opsLabel;
		// Rebuild with the runtime zod copy (real types preserved) and make
		// all non-operation fields optional in the merged schema.
		const optionalSchema = cloneFieldForRuntime(runtimeZ, schema).optional().describe(desc);
		mergedShape[key] = optionalSchema;
	}

	return runtimeZ.object(mergedShape);
}

export function buildUnifiedSchema(
	runtimeZ: typeof zodNamespace,
	resource: string,
	operations: string[],
	names: ToolNames,
) {
	if (resource !== 'transaction') {
		// Read-only resources — simple getAll-only schema. Strict, like the
		// zero-arg helpers: non-strict zod silently strips junk args, which
		// hides caller mistakes from the MCP validation layer.
		const props: Record<string, any> = {
			operation: runtimeZ
				.enum(operations as [string, ...string[]])
				.describe(`Operation to perform: ${operations.join(', ')}`),
		};
		if (resource === 'budget') {
			props.search = runtimeZ
				.string()
				.optional()
				.describe(
					'Only return budgets whose name or tag contains this text (case-insensitive), e.g. search: "eating out".',
				);
		}
		return runtimeZ.object(props).strict();
	}

	// Transaction — merge all operation schemas
	const schemasByOp: Record<string, z.ZodObject<any>> = {
		getAll: getTransactionGetAllSchema(names),
		create: getTransactionCreateSchema(names),
		update: getTransactionUpdateSchema(names),
		delete: getTransactionDeleteSchema(names),
		aggregate: getTransactionAggregateSchema(names),
	};

	// Filter to only requested operations
	const activeSchemas: Record<string, z.ZodObject<any>> = {};
	for (const op of operations) {
		if (schemasByOp[op]) activeSchemas[op] = schemasByOp[op];
	}

	return mergeSchemas(runtimeZ, operations, activeSchemas);
}

export function isValidOperation(resource: string, operation: string): boolean {
	const config = RESOURCE_OPERATIONS[resource];
	if (!config) return false;
	return config.ops.includes(operation);
}

// ---------------------------------------------------------------------------
// Runtime schema builder wrapper
// ---------------------------------------------------------------------------
export function getRuntimeSchemaBuilders(runtimeZ: typeof zodNamespace) {
	return {
		buildUnifiedSchema: (resource: string, operations: string[], names: ToolNames) =>
			buildUnifiedSchema(runtimeZ, resource, operations, names),
	};
}
