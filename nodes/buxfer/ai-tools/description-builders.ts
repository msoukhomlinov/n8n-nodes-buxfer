/**
 * LLM-optimised descriptions for Buxfer AI Tools.
 *
 * Descriptions are the primary mechanism for guiding the LLM.
 * Keep unified descriptions under ~2000 characters per tool.
 */
import type { ToolNames } from './tool-naming.js';

// ---------------------------------------------------------------------------
// Per-operation description builders
// ---------------------------------------------------------------------------

function buildGetAllDescription(resource: string, names: ToolNames): string {
	if (resource === 'transaction') {
		return [
			`List/search transactions.`,
			`ALWAYS use 'search' for text lookups — case-insensitive partial match on descriptions and tag names (e.g. search="Qantas" with startDate/endDate for "in the last 30 days").`,
			`If an exact search finds nothing, fuzzy (near-word) rescue runs automatically and those matches are flagged — no retry needed for typos. Set fuzzy=true only to also include near-word matches alongside exact ones.`,
			`When the user says "recently" or "lately" without a range, use the last 30 days.`,
			`For spending TOTALS (e.g. "how much on X", "total this month by tag") use operation 'aggregate' instead — it returns summed totals in one call.`,
			`search/aggregate scan up to the 2000 most recent transactions of the window; results report 'scanned' coverage — respect scanTruncated when answering.`,
			`Results contain numeric 'id' — capture it for chained get/update/delete calls.`,
			`Use ${names.listAccounts} and ${names.listTags} to discover valid filter values.`,
			`Use the type filter (type: "expense") to list spending only (excludes transfers, income, shared bills, loans).`,
			`Default limit is 25 — increase to 100 if you expect many results.`,
		].join(' ');
	}
	const byResource: Record<string, string> = {
		account:
			`List all Buxfer accounts: id, name, bank, balance, currency, lastSynced. Use to discover valid accountId values for transaction filters.`,
		budget:
			`List per-tag spending budgets. Fields: name (tag path), tagId, limit (planned amount per period), spent (actual in the CURRENT period), balance, period (prose string of the current period, e.g. '21 Aug - 20 Sep 2026'), isRolledOver. NOTE: startDate is the budget's CREATION date (not the period start); balance may exceed the limit because rollovers carry over unused amounts — to answer "is the budget being kept", compare spent with limit. Use the search param for one budget by name or tag (e.g. search: "eating out"); for actual spending by tag outside budget periods use buxfer_transaction with operation 'aggregate' and groupBy 'tag'.`,
		contact:
			`List shared-bill / loan contacts: id, name, email, balance (amount currently owed to or from them). Use to check who you shared bills or loans with.`,
		group:
			`List account groups (how accounts are organized). Returns an empty list if no groups exist.`,
		loan:
			`List loans: entity (person or account name), type (contact or account), balance (absolute amount), description, plus the structured fields direction ("you owe" = the user owes the entity; "you receive" = the entity owes the user) and owesYou (true when the entity owes the user). Note: loan items have NO numeric id field. To answer "who do I owe / who owes me": owe = direction "you owe"; owed to you = direction "you receive".`,
		reminder:
			`List recurring reminders (scheduled items to come due). Returns an empty list if none exist.`,
		tag:
			`List all Buxfer tags: id, full-path name (e.g. 'Health / Medicare'), parentId, relativeName. These are the canonical tag names accepted by the buxfer_transaction tagName filter.`,
	};
	return byResource[resource] || `List all ${resource}s. Results contain numeric 'id' fields for reference.`;
}

function buildCreateDescription(names: ToolNames): string {
	return [
		`Create a new transaction.`,
		`Required fields: description (string), amount (number), date (YYYY-MM-DD),`,
		`accountId (number — use ${names.listAccounts}), type (expense|income|transfer|sharedBill|loan|paidForFriend),`,
		`status (cleared|pending).`,
		`Tags: comma-separated names (use ${names.listTags} to discover valid names).`,
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

function buildAggregateDescription(names: ToolNames): string {
	return [
		`Compute spending totals without fetching raw transaction lists. totals.moved = line-sum of transfer amounts (an inter-account movement is logged on both sides, so moved can be up to 2x the real volume; interest credits are included). Use it to answer "how much moved between my accounts".`,
		`groupBy: tag | account | type | day | week | month (omit for a single grand total).`,
		`Combine with search/startDate/endDate for e.g. "spent on Qantas in the last 30 days".`,
		`Returns per-group spent/earned/net counts plus the largest sample items; totals are exact over the scanned window (see coverage fields).`,
		`topN without groupBy returns the top N largest transactions across the window; use the type filter (type: "expense") for expense-specific questions.`,
		`ALWAYS set startDate/endDate for period questions ("this month", "this year", "last 30 days") - without dates the call spans ALL history and is capped at 2000 transactions.`,
		`When groupBy is 'tag', a transaction tagged with multiple tags is counted under EACH of those tags, so per-tag rows can sum to more than total spent.`,
		`Use ${names.listAccounts} and ${names.listTags} to discover valid filter values.`,
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
	names: ToolNames,
): string {
	if (resource === 'transaction') {
		const parts: string[] = [
			`Buxfer transaction tool. Operations: ${operations.join(', ')}.`,
		];

		if (operations.includes('getAll')) {
			parts.push(`• getAll: ${buildGetAllDescription(resource, names)}`);
		}
		if (operations.includes('aggregate')) {
			parts.push(`• aggregate: ${buildAggregateDescription(names)}`);
		}
		if (operations.includes('create')) {
			parts.push(`• create: ${buildCreateDescription(names)}`);
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
	return `Buxfer ${resource} tool. ${buildGetAllDescription(resource, names)}`;
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
