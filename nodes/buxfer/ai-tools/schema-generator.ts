/**
 * Zod schemas for Buxfer AI Tools — one unified schema per resource.
 *
 * Compile-time `z` is a VALUE import (needed for z.object() etc).
 * Runtime schemas are built via getRuntimeSchemaBuilders(runtimeZod).
 */
import { z } from 'zod';
import type { z as zodNamespace } from 'zod';

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
	transaction: { ops: ['getAll', 'create', 'update', 'delete'] },
};

export const WRITE_OPERATIONS = ['create', 'update', 'delete'];

// ---------------------------------------------------------------------------
// Per-operation schemas (compile-time z — for type checking & template)
// ---------------------------------------------------------------------------

// -- Transaction schemas --
function getTransactionGetAllSchema() {
	return z.object({
		operation: z.literal('getAll').describe("List/search transactions."),
		search: z.string().optional().describe(
			'ALWAYS use this for text lookups. Searches transaction descriptions. Partial match.',
		),
		accountId: z.number().optional().describe(
			'Filter by account ID (use buxfer_listAccounts to find IDs).',
		),
		tagName: z.string().optional().describe(
			'Filter by tag name (use buxfer_listTags to discover valid tag names).',
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

function getTransactionCreateSchema() {
	return z.object({
		operation: z.literal('create').describe('Create a new transaction.'),
		description: z.string().describe('Transaction description/memo (required).'),
		amount: z.number().describe('Transaction amount (required). Positive number.'),
		date: z.string().describe('Transaction date in YYYY-MM-DD format (required).'),
		accountId: z.number().describe(
			'Account ID (required). Use buxfer_listAccounts to find the correct ID.',
		),
		type: z.enum(TRANSACTION_TYPES).describe(
			'Transaction type (required): expense = outgoing, income = incoming, transfer = between accounts, sharedBill = split cost, loan = money lent/borrowed, paidForFriend = paid on behalf.',
		),
		status: z.enum(TRANSACTION_STATUSES).describe(
			'Transaction status (required): cleared = confirmed, pending = unconfirmed.',
		),
		tags: z.string().optional().describe(
			'Comma-separated tag names (e.g. "Food,Transport"). Use buxfer_listTags to discover valid names.',
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

function getTransactionUpdateSchema() {
	return z.object({
		operation: z.literal('update').describe('Update an existing transaction.'),
		id: z.number().describe(
			'Transaction ID (required). Use buxfer_transaction with operation getAll to find IDs.',
		),
		description: z.string().optional().describe('Updated description/memo.'),
		amount: z.number().optional().describe('Updated amount.'),
		date: z.string().optional().describe('Updated date in YYYY-MM-DD format.'),
		accountId: z.number().optional().describe(
			'Updated account ID. Use buxfer_listAccounts to find IDs.',
		),
		type: z.enum(TRANSACTION_TYPES).optional().describe('Updated transaction type.'),
		status: z.enum(TRANSACTION_STATUSES).optional().describe('Updated status.'),
		tags: z.string().optional().describe(
			'Updated comma-separated tag names. Use buxfer_listTags to discover valid names.',
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

function getTransactionDeleteSchema() {
	return z.object({
		operation: z.literal('delete').describe('Delete a transaction.'),
		id: z.number().describe(
			'Transaction ID (required). Use buxfer_transaction with operation getAll to find IDs.',
		),
	});
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
		const existingDesc = (schema as any)._def?.description ?? '';
		const opsLabel = `[Used by: ${ops.join(', ')}]`;
		const desc = existingDesc ? `${existingDesc} ${opsLabel}` : opsLabel;
		// Make all non-operation fields optional in the merged schema
		const optionalSchema = runtimeZ.unknown().optional().describe(desc);
		mergedShape[key] = optionalSchema;
	}

	return runtimeZ.object(mergedShape);
}

export function buildUnifiedSchema(
	runtimeZ: typeof zodNamespace,
	resource: string,
	operations: string[],
) {
	if (resource !== 'transaction') {
		// Read-only resources — simple getAll-only schema
		return runtimeZ.object({
			operation: runtimeZ
				.enum(operations as [string, ...string[]])
				.describe(`Operation to perform: ${operations.join(', ')}`),
		});
	}

	// Transaction — merge all operation schemas
	const schemasByOp: Record<string, z.ZodObject<any>> = {
		getAll: getTransactionGetAllSchema(),
		create: getTransactionCreateSchema(),
		update: getTransactionUpdateSchema(),
		delete: getTransactionDeleteSchema(),
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
		buildUnifiedSchema: (resource: string, operations: string[]) =>
			buildUnifiedSchema(runtimeZ, resource, operations),
	};
}
