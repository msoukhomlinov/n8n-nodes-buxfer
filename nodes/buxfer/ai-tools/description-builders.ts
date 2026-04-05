/**
 * LLM-optimised descriptions for Buxfer AI Tools.
 *
 * Descriptions are the primary mechanism for guiding the LLM.
 * Keep unified descriptions under ~2000 characters per tool.
 */

// ---------------------------------------------------------------------------
// Per-operation description builders
// ---------------------------------------------------------------------------

function buildGetAllDescription(resource: string): string {
	if (resource === 'transaction') {
		return [
			`List/search transactions.`,
			`ALWAYS use 'search' first for text lookups — it does partial matching on descriptions.`,
			`Results contain numeric 'id' — capture it for chained get/update/delete calls.`,
			`Use buxfer_listAccounts and buxfer_listTags to discover valid filter values.`,
			`Default limit is 25 — increase to 100 if you expect many results.`,
		].join(' ');
	}
	return `List all ${resource}s. Results contain numeric 'id' fields for reference.`;
}

function buildCreateDescription(): string {
	return [
		`Create a new transaction.`,
		`Required fields: description (string), amount (number), date (YYYY-MM-DD),`,
		`accountId (number — use buxfer_listAccounts), type (expense|income|transfer|sharedBill|loan|paidForFriend),`,
		`status (cleared|pending).`,
		`Tags: comma-separated names (use buxfer_listTags to discover valid names).`,
		`Confirm field values with user before executing when acting autonomously.`,
		`Returns assigned 'id'.`,
	].join(' ');
}

function buildUpdateDescription(): string {
	return [
		`Update an existing transaction.`,
		`PREREQUISITE: numeric ID from a prior getAll result.`,
		`Use this tool with operation 'getAll' to find the transaction first.`,
		`Only include fields you want to change — omitted fields stay unchanged.`,
		`Confirm field values with user before executing when acting autonomously.`,
	].join(' ');
}

function buildDeleteDescription(): string {
	return [
		`Delete a transaction permanently.`,
		`PREREQUISITE: numeric ID from a prior getAll result.`,
		`ONLY on explicit user intent. Do not infer from context.`,
		`Confirm ID is correct before proceeding.`,
	].join(' ');
}

// ---------------------------------------------------------------------------
// Unified description builder
// ---------------------------------------------------------------------------

export function buildUnifiedDescription(
	resource: string,
	operations: string[],
): string {
	if (resource === 'transaction') {
		const parts: string[] = [
			`Buxfer transaction tool. Operations: ${operations.join(', ')}.`,
		];

		if (operations.includes('getAll')) {
			parts.push(`• getAll: ${buildGetAllDescription(resource)}`);
		}
		if (operations.includes('create')) {
			parts.push(`• create: ${buildCreateDescription()}`);
		}
		if (operations.includes('update')) {
			parts.push(`• update: ${buildUpdateDescription()}`);
		}
		if (operations.includes('delete')) {
			parts.push(`• delete: ${buildDeleteDescription()}`);
		}

		return parts.join('\n');
	}

	// Read-only resources
	return `Buxfer ${resource} tool. ${buildGetAllDescription(resource)}`;
}

// ---------------------------------------------------------------------------
// Helper tool descriptions
// ---------------------------------------------------------------------------

export function buildListAccountsDescription(): string {
	return 'List all Buxfer accounts with their IDs and names. Use this to discover valid accountId values for transaction operations.';
}

export function buildListTagsDescription(): string {
	return 'List all Buxfer tags with their IDs and names. Use this to discover valid tag names for transaction create/update operations.';
}
