/**
 * Execution routing for Buxfer AI Tools.
 *
 * Called from both func() (supplyData/MCP) and execute() (Agent V3) paths.
 * All return paths use JSON.stringify(wrapSuccess/wrapError(...)).
 */
import type { IExecuteFunctions, ISupplyDataFunctions } from 'n8n-workflow';
import { buxferApiRequest } from '../api.js';
import type { ToolNames } from './tool-naming.js';
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

export function stripMetadata(params: Record<string, unknown>): Record<string, unknown> {
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
// In-house fuzzy matching (dependency-free)
// ---------------------------------------------------------------------------

/** Iterative two-row Levenshtein distance. */
function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;
	let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
	let curr: number[] = new Array(b.length + 1);
	for (let i = 1; i <= a.length; i++) {
		curr[0] = i;
		const ca = a[i - 1];
		for (let j = 1; j <= b.length; j++) {
			const cost = ca === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
		}
		[prev, curr] = [curr, prev];
	}
	return prev[b.length];
}

/** One search term vs one text: substring first, then (if allowed) near-word on space-separated tokens. */
function termMatches(term: string, text: string, allowFuzzy: boolean): boolean {
	if (text.includes(term)) return true;
	if (!allowFuzzy) return false;
	if (term.length < 3) return false;
	const words = text.split(/[^a-z0-9]+/i);
	const maxDist = term.length <= 4 ? 1 : 2;
	for (const w of words) {
		if (w.length < 3 || Math.abs(w.length - term.length) > maxDist) continue;
		if (levenshtein(term, w.toLowerCase()) <= maxDist) return true;
	}
	return false;
}

/**
 * Searchable text of a transaction: description, extraInfo and tag names.
 * (Buxfer has no server-side text search, so this is what `search` matches.)
 */
function searchTargetText(t: any): string {
	const tags = Array.isArray(t?.tagNames)
		? t.tagNames.join(' ')
		: typeof t?.tags === 'string'
			? t.tags
			: '';
	return `${t?.description || ''} ${t?.extraInfo || ''} ${tags}`;
}

/** Tag names of a transaction, from whatever shape the API provided. */
function tagNamesOf(t: any): string[] {
	if (Array.isArray(t?.tagNames) && t.tagNames.length) return t.tagNames;
	if (typeof t?.tags === 'string' && t.tags.trim()) {
		return t.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
	}
	return [];
}

/**
 * Money split for a transaction. Buxfer returns POSITIVE amounts on every
 * transaction; the direction comes from `type` (and the expenseAmount /
 * incomeAmount fields). Transfers move money between own accounts and count
 * as neither spent nor earned.
 */
function spentEarnedOf(t: any): { spent: number; earned: number } {
	const amount = Math.abs(Number(t?.amount) || 0);
	const expenseField = Number(t?.expenseAmount);
	const incomeField = Number(t?.incomeAmount);
	if (t?.type === 'income') {
		return { spent: 0, earned: Number.isNaN(incomeField) ? amount : incomeField };
	}
	if (t?.type === 'expense') {
		return { spent: Number.isNaN(expenseField) ? amount : expenseField, earned: 0 };
	}
	return {
		spent: Number.isNaN(expenseField) ? 0 : expenseField,
		earned: Number.isNaN(incomeField) ? 0 : incomeField,
	};
}

/** ISO week key (YYYY-Www) from a YYYY-MM-DD string, for groupBy 'week'. */
function isoWeekKey(dateStr: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'unknown';
	const d = new Date(dateStr + 'T00:00:00Z');
	const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	const dayNr = (target.getUTCDay() + 6) % 7;
	target.setUTCDate(target.getUTCDate() - dayNr + 3);
	const firstThursday = target.getTime();
	target.setUTCMonth(0, 1);
	if (target.getUTCDay() !== 4) {
		target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
	}
	const week = 1 + Math.round((firstThursday - target.getTime()) / (7 * 24 * 3600 * 1000));
	return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Transaction window scan (shared by getAll and aggregate)
// ---------------------------------------------------------------------------

const SCAN_PAGE_SIZE = 100; // Buxfer serves up to 100 transactions per page
const MAX_SCAN_PAGES = 20; // 20 x 100 = 2000 transactions max
const SCAN_BATCH = 4; // parallel requests per paging round

interface WindowScan {
	items: any[];
	pages: number;
	truncated: boolean;
}

/**
 * Page through the (server-filtered) Buxfer transaction window.
 *
 * Buxfer has no text-search parameter and one page = 100 transactions, so
 * client-side search/aggregation must page to the end of the window or it
 * silently skips matches. Pages are fetched in parallel batches of
 * SCAN_BATCH to keep latency down; a short page ends the scan. Hard-capped
 * at MAX_SCAN_PAGES so an unbounded window cannot loop forever.
 *
 * `pages` in the result is the highest page that returned DATA (parallel
 * rounds may request slots beyond it; empty slots are not reported), so
 * `scanned ≈ pages * 100 ± last short page`.
 */
async function scanTransactionWindow(
	context: any,
	filters: Record<string, unknown>,
	fullWindow: boolean,
): Promise<WindowScan> {
	const fetchPage = async (
		page: number,
	): Promise<{ page: number; batch: any[]; done: boolean }> => {
		const response = await buxferApiRequest(
			context,
			'GET',
			'/transactions',
			{ ...filters, page },
		);
		const batch: any[] = response?.response?.transactions || [];
		return { page, batch, done: batch.length < SCAN_PAGE_SIZE };
	};

	const items: any[] = [];
	let pages = 0; // highest page that returned data
	let cursor = 0; // next page slot to fetch

	const first = await fetchPage(1);
	if (first.batch.length > 0) pages = 1;
	items.push(...first.batch);
	cursor = 1;
	if (!fullWindow || first.done) {
		return { items, pages, truncated: false };
	}

	while (cursor < MAX_SCAN_PAGES) {
		const roundSize = Math.min(SCAN_BATCH, MAX_SCAN_PAGES - cursor);
		const start = cursor + 1;
		const round = await Promise.all(
			Array.from({ length: roundSize }, (_, i) => fetchPage(start + i)),
		);
		let earlyDone = false;
		for (const res of round) {
			items.push(...res.batch);
			if (res.batch.length > 0) pages = Math.max(pages, res.page);
			cursor = res.page;
			if (res.done) earlyDone = true;
		}
		if (earlyDone) return { items, pages, truncated: false };
		if (cursor >= MAX_SCAN_PAGES) return { items, pages, truncated: true };
	}
	return { items, pages, truncated: true };
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------
/**
 * Resolve a tag NAME to the numeric tagId Buxfer's API actually filters by.
 * Buxfer /transactions ignores a tag name in the query (silently!), so both
 * the getAll and aggregate branches MUST resolve before calling the API.
 * Returns the resolved {tagId, canonicalName} or throws a TagResolutionError
 * carrying the closest-candidate list for a precise NO_RESULTS_FOUND error.
 */
class TagResolutionError extends Error {
	constructor(public readonly badName: string, public readonly candidates: string[]) {
		super(`No tag named "${badName}".`);
	}
}

async function resolveTagFilter(
	context: IExecuteFunctions | ISupplyDataFunctions,
	tagName: string,
): Promise<{ tagId: string; canonicalName: string }> {
	const tagResp = await buxferApiRequest(context as any, 'GET', '/tags');
	const tagList: any[] = tagResp?.response?.tags || [];
	const wanted = String(tagName).toLowerCase();
	const lastSeg = (n: string) => {
		// Buxfer tag paths are 'Parent / Child' — spaces AROUND the slash, so
		// slice at ' / ' (not '/') or trim the leading space.
		const s = n.toLowerCase();
		const i = s.lastIndexOf(' / ');
		return i >= 0 ? s.slice(i + 3) : (s.includes('/') ? s.slice(s.lastIndexOf('/') + 1).trim() : s);
	};
	const resolved: any =
		tagList.find((t: any) => String(t.name).toLowerCase() === wanted) ||
		tagList.find((t: any) => lastSeg(String(t.name)) === wanted) ||
		(wanted.includes('/ ')
			? tagList.find(
					(t: any) =>
						String(t.name).toLowerCase() === wanted.split(' / ').pop(),
				)
			: undefined);
	if (!resolved) {
		const closest = tagList
			.map((t: any) => String(t.name))
			.filter(
				(n: string) =>
					levenshtein(n.toLowerCase(), wanted) <= 3 ||
					levenshtein(lastSeg(n), wanted) <= 3,
			)
			.slice(0, 8);
		throw new TagResolutionError(String(tagName), closest);
	}
	return { tagId: String(resolved.id), canonicalName: String(resolved.name) };
}

export async function executeAiTool(
	context: IExecuteFunctions | ISupplyDataFunctions,
	resource: string,
	operation: string,
	params: Record<string, unknown>,
	names: ToolNames,
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
							`Use ${names.main} with operation 'getAll'.`,
							undefined,
							names.main,
						),
					);
				}
				const responseKey = RESPONSE_KEYS[resource]!;
				const response = await buxferApiRequest(
					context as any,
					'GET',
					`/${responseKey}`,
				);
				let items: any[] = response?.response?.[responseKey] || [];
				if (resource === 'budget' && typeof cleanParams.search === 'string' && cleanParams.search) {
					const needle = String(cleanParams.search).toLowerCase();
					items = items.filter(
						(b: any) =>
							String(b.name || '').toLowerCase().includes(needle) ||
							String(b.tag?.name || b.tag || '').toLowerCase().includes(needle),
					);
				}
				if (resource === 'loan') {
					// Structure the direction that the API only carries in the
					// free-text 'description' ('you owe' / 'you receive').
					items = items.map((l: any) => {
						const d = String(l.description || '').toLowerCase();
						const direction = d.includes('you owe') ? 'you owe'
							: d.includes('you receive') ? 'you receive'
							: 'unknown';
						return {
							...l,
							direction,
							owesYou: direction === 'you receive',
						};
					});
				}
				return JSON.stringify(
					wrapSuccess(resource, operation, {
						items,
						count: items.length,
					}, names.main),
				);
			}

			// ---------------------------------------------------------------
			// Transaction
			// ---------------------------------------------------------------
			case 'transaction': {
				switch (operation) {
					case 'getAll': {
					const filters: Record<string, unknown> = {};
					const searchRaw =
						typeof cleanParams.search === 'string'
							? cleanParams.search.trim()
							: '';
					const wantsSearch = searchRaw.length > 0;
					const hasFilters =
						wantsSearch ||
						cleanParams.accountId ||
						cleanParams.tagName ||
						cleanParams.startDate ||
						cleanParams.endDate ||
						cleanParams.status;

					if (cleanParams.accountId) filters.accountId = cleanParams.accountId;
					if (cleanParams.tagName) {
						const tag = await resolveTagFilter(context, String(cleanParams.tagName));
						filters.tagId = tag.tagId;
						// keep the canonical (full-path) name in the response envelope
						cleanParams.tagName = tag.canonicalName;
					}
					if (cleanParams.startDate) filters.startDate = cleanParams.startDate;
					if (cleanParams.endDate) filters.endDate = cleanParams.endDate;
					if (cleanParams.status) filters.status = cleanParams.status;

					// Full-window paging whenever a server-side filter or search is
					// active (otherwise a bare call answers from the single most
					// recent page — documented via windowNote).
					const fullWindow = Boolean(hasFilters) || Boolean(cleanParams.type);
					const scan = await scanTransactionWindow(context, filters, fullWindow);
					const scanned = scan.items.length;
					// Client-side type filter (the Buxfer API has no type param).
					const typeScoped = cleanParams.type
						? scan.items.filter((t: any) => t.type === cleanParams.type)
						: scan.items;

					// Client-side search: all terms must match (AND).
					// Default (fuzzy unset): EXACT only — but if exact finds
					// nothing, fuzzy near-word RESCUE kicks in automatically
					// (the 0.7.0 typo rescue), flagged via coverage.
					// fuzzy:true: explicit union of exact + fuzzy matches.
					// fuzzy:false: exact only, no rescue.
					const exact: any[] = [];
					const fuzzyItems: any[] = [];
					if (wantsSearch) {
						const terms = searchRaw.toLowerCase().split(/\s+/).filter(Boolean);
						for (const t of typeScoped) {
							const text = searchTargetText(t).toLowerCase();
							if (terms.every((term: string) => text.includes(term))) {
								t.match = 'exact';
								exact.push(t);
							} else if (terms.every((term: string) => termMatches(term, text, true))) {
								t.match = 'fuzzy';
								fuzzyItems.push(t);
							}
						}
					}
					const useFuzzy =
						cleanParams.fuzzy === true ||
						(wantsSearch && cleanParams.fuzzy !== false && exact.length === 0 && fuzzyItems.length > 0);
					const filtered = wantsSearch
						? useFuzzy
							? [...exact, ...fuzzyItems]
							: exact
						: typeScoped;

					// Apply limit
					const limit =
						typeof cleanParams.limit === 'number' ? cleanParams.limit : 25;
					const truncated = filtered.length > limit;
					const limited = truncated ? filtered.slice(0, limit) : filtered;

					// Ensure tagNames is populated as an array. The Buxfer API
					// already returns both `tags` (comma-separated tag NAMES,
					// e.g. "Food / Grocery, Claimable / Tax") and `tagNames`
					// (array) on transactions; fill the array from the string
					// when the API omitted it. No reference call needed.
					for (const t of limited) {
						if (Array.isArray(t?.tagNames)) continue;
						if (typeof t?.tags === 'string' && t.tags.trim()) {
							t.tagNames = t.tags
								.split(',')
								.map((s: string) => s.trim())
								.filter(Boolean);
						} else {
							t.tagNames = [];
						}
					}

					// Filtered empty guard
					if (hasFilters && filtered.length === 0) {
						return JSON.stringify(
							formatNoResultsFound(resource, operation, cleanParams, names.main),
						);
					}

					const coverage: Record<string, unknown> = {
						scanned,
						pages: scan.pages,
						windowComplete: !scan.truncated,
					};
					if (scan.truncated) {
						coverage.scanTruncated = true;
						coverage.scanNote =
							'Only the 2000 most recent transactions of the window were scanned. Narrow the date range or filter by account to cover more history.';
					}
					if (wantsSearch) {
						coverage.matchCounts = { exact: exact.length, fuzzy: fuzzyItems.length };
						const usedFuzzy = useFuzzy && fuzzyItems.length > 0;
						if (usedFuzzy && exact.length === 0) coverage.fuzzyFallback = true;
						if (usedFuzzy && exact.length > 0) coverage.fuzzyMerged = true;
					} else if (!hasFilters) {
						coverage.windowNote =
							'No filters supplied — the 100 most recent transactions were scanned. Add startDate/endDate or accountId to target a window.';
					}

					const result: Record<string, unknown> = {
						items: limited,
						count: limited.length,
						coverage,
					};
					if (truncated) result.truncated = true;
					return JSON.stringify(wrapSuccess(resource, operation, result, names.main));
				}

				case 'aggregate': {
					const filters: Record<string, unknown> = {};
					const searchRaw =
						typeof cleanParams.search === 'string'
							? cleanParams.search.trim()
							: '';
					const wantsSearch = searchRaw.length > 0;
					if (cleanParams.accountId) filters.accountId = cleanParams.accountId;
					if (cleanParams.tagName) {
						// Same trap as getAll: Buxfer filters transactions by tagId,
						// not by name — resolve first (previously a silent no-op here).
						const tag = await resolveTagFilter(context, String(cleanParams.tagName));
						filters.tagId = tag.tagId;
						cleanParams.tagName = tag.canonicalName;
					}
					if (cleanParams.startDate) filters.startDate = cleanParams.startDate;
					if (cleanParams.endDate) filters.endDate = cleanParams.endDate;
					const hasFilters =
						wantsSearch ||
						Object.keys(filters).length > 0 ||
						!!cleanParams.type;

					// Aggregation is only correct over the FULL filtered window.
					const scan = await scanTransactionWindow(context, filters, true);
					let items: any[] = scan.items;
					if (cleanParams.type) {
						// Client-side type filter (the Buxfer API has no type param):
						// narrows totals to e.g. 'expense' for "how much did I spend".
						items = items.filter((t: any) => t.type === cleanParams.type);
					}

					// Search semantics (same as getAll): default = EXACT only,
					// with automatic fuzzy rescue when exact finds nothing
					// (flagged via coverage); fuzzy:true = explicit union of
					// exact + fuzzy; fuzzy:false = exact only, no rescue.
					let exactCount = 0;
					let fuzzyCount = 0;
					let fuzzyContributed = false;
					if (wantsSearch) {
						const terms = searchRaw.toLowerCase().split(/\s+/).filter(Boolean);
						const exactKeep: any[] = [];
						const fuzzyKeep: any[] = [];
						for (const t of items) {
							const text = searchTargetText(t).toLowerCase();
							if (terms.every((term: string) => text.includes(term))) {
								exactKeep.push(t);
							} else if (terms.every((term: string) => termMatches(term, text, true))) {
								fuzzyKeep.push(t);
							}
						}
						exactCount = exactKeep.length;
						fuzzyCount = fuzzyKeep.length;
						const useFuzzy =
							cleanParams.fuzzy === true ||
							(cleanParams.fuzzy !== false && exactKeep.length === 0 && fuzzyKeep.length > 0);
						items = useFuzzy ? [...exactKeep, ...fuzzyKeep] : exactKeep;
						fuzzyContributed = useFuzzy && fuzzyCount > 0;
					}

					if (hasFilters && items.length === 0) {
						return JSON.stringify(
							formatNoResultsFound(resource, operation, cleanParams, names.main),
						);
					}

					const groupBy =
						typeof cleanParams.groupBy === 'string' && cleanParams.groupBy
							? cleanParams.groupBy
							: undefined;
					const topN =
						typeof cleanParams.topN === 'number' && cleanParams.topN > 0
							? Math.min(cleanParams.topN, 20)
							: 3;

					const round2 = (n: number): number => Math.round(n * 100) / 100;
					const totals = { spent: 0, earned: 0, moved: 0 };
					const groups = new Map<
						string,
						{ key: string; spent: number; earned: number; moved: number; count: number; items: any[] }
					>();

					// Group keys come straight from the transaction payload: Buxfer
					// resolves accountName and tag names server-side, so no
					// reference lookups are needed.
					const keysOf = (t: any): string[] | null => {
						if (!groupBy) return null;
						switch (groupBy) {
							case 'tag': {
								const names = tagNamesOf(t);
								return names.length ? names.sort() : ['untagged'];
							}
							case 'account':
								return [t.accountName || `account ${t.accountId}`];
							case 'type':
								return [t.type || 'unknown'];
							case 'day':
								return [t.date || 'unknown'];
							case 'week':
								return [isoWeekKey(String(t.date || ''))];
							case 'month':
								return [String(t.date || '').slice(0, 7) || 'unknown'];
							default:
								return null;
						}
					};

					for (const t of items) {
						const { spent, earned } = spentEarnedOf(t);
						totals.spent += spent;
						totals.earned += earned;
						if (t.type === 'transfer') {
							totals.moved += Math.abs(Number(t.amount) || 0);
						}
						const keys = keysOf(t);
						if (!keys) continue;
						// Multi-tag transactions are counted under each tag.
						for (const k of keys) {
							const g =
								groups.get(k) ||
								{ key: k, spent: 0, earned: 0, moved: 0, count: 0, items: [] };
							g.spent += spent;
							g.earned += earned;
							if (t.type === 'transfer') {
								g.moved += Math.abs(Number(t.amount) || 0);
							}
							g.count += 1;
							g.items.push(t);
							groups.set(k, g);
						}
					}

					let minDate = '';
					let maxDate = '';
					for (const t of items) {
						if (!t.date) continue;
						if (!minDate || String(t.date) < minDate) minDate = String(t.date);
						if (!maxDate || String(t.date) > maxDate) maxDate = String(t.date);
					}

					let groupsOut: any[] | undefined;
					if (groups.size > 0) {
						groupsOut = [...groups.values()]
							.map((g) => {
								const topItems = g.items
									.slice()
									.sort(
										(a: any, b: any) =>
											Math.abs(Number(b.amount) || 0) -
											Math.abs(Number(a.amount) || 0),
									)
									.slice(0, topN)
									.map((t: any) => ({
										id: t.id,
										description: t.description,
										amount: t.amount,
										date: t.date,
										tagNames: Array.isArray(t.tagNames) ? t.tagNames : undefined,
									}));
								const groupOut: Record<string, unknown> = {
									key: g.key,
									spent: round2(g.spent),
									earned: round2(g.earned),
									net: round2(g.earned - g.spent),
									count: g.count,
									topItems,
								};
								if (g.moved > 0) groupOut.moved = round2(g.moved);
								return groupOut;
							})
							.sort((a, b) => (b.spent as number) - (a.spent as number));
					}

					const coverage: Record<string, unknown> = {
						scanned: items.length,
						windowScanned: scan.items.length,
						pages: scan.pages,
						windowComplete: !scan.truncated,
					};
					if (scan.truncated) {
						coverage.scanTruncated = true;
						coverage.scanNote =
							'Totals only cover the 2000 most recent transactions of the window. Narrow the date range to cover more history.';
					}
					if (wantsSearch) coverage.search = searchRaw;
					if (wantsSearch) coverage.matchCounts = { exact: exactCount, fuzzy: fuzzyCount };
					if (fuzzyContributed && exactCount === 0) coverage.fuzzyFallback = true;
					if (fuzzyContributed && exactCount > 0) coverage.fuzzyMerged = true;

					const result: Record<string, unknown> = {
						groupBy: groupBy || 'total',
						window: {
							start: (filters.startDate as string) || minDate || 'all',
							end: (filters.endDate as string) || maxDate || 'all',
						},
						totals: {
							spent: round2(totals.spent),
							earned: round2(totals.earned),
							moved: round2(totals.moved),
							net: round2(totals.earned - totals.spent),
						},
						coverage,
					};
					if (groupsOut) result.groups = groupsOut;
					if (!groupBy && topN > 0) {
						// 'Top N largest transactions' across the window (all types),
						// so a topN call without groupBy is never a silent no-op.
						result.topItems = items
							.slice()
							.sort(
								(a: any, b: any) =>
									Math.abs(Number(b.amount) || 0) -
									Math.abs(Number(a.amount) || 0),
							)
							.slice(0, topN)
							.map((t: any) => ({
								id: t.id,
								description: t.description,
								amount: t.amount,
								date: t.date,
								accountName: t.accountName,
								type: t.type,
							}));
						result.note = cleanParams.type
						? `Top ${topN} transactions of type '${cleanParams.type}' by amount across the scanned window.`
						: `Top ${topN} transactions by amount across the scanned window, all types included.`;
					}
					if (groupBy === 'tag') {
						result.note = 'Transactions with multiple tags are counted under each tag.';
					}
					return JSON.stringify(wrapSuccess(resource, operation, result, names.main));
				}

case 'create': {
						const data: Record<string, unknown> = {};

						// Required fields
						if (!cleanParams.description)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'description is required.', 'Provide the description field.', undefined, names.main),
							);
						if (cleanParams.amount === undefined)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'amount is required.', 'Provide the amount field.', undefined, names.main),
							);
						if (!cleanParams.date)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'date is required (YYYY-MM-DD).', 'Provide the date field.', undefined, names.main),
							);
						if (!cleanParams.accountId)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'accountId is required.', `Use ${names.listAccounts} to find the correct account ID.`, undefined, names.main),
							);
						if (!cleanParams.type)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'type is required.', 'Provide type: expense, income, transfer, sharedBill, loan, or paidForFriend.', undefined, names.main),
							);
						if (!cleanParams.status)
							return JSON.stringify(
								wrapError(resource, operation, ERROR_TYPES.MISSING_REQUIRED_FIELD, 'status is required.', 'Provide status: cleared or pending.', undefined, names.main),
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
							wrapSuccess(resource, operation, created, names.main),
						);
					}

					case 'update': {
						if (!cleanParams.id) {
							return JSON.stringify(formatMissingIdError(resource, operation, names.main));
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
							wrapSuccess(resource, operation, updated, names.main),
						);
					}

					case 'delete': {
						if (!cleanParams.id) {
							return JSON.stringify(formatMissingIdError(resource, operation, names.main));
						}

						await buxferApiRequest(context as any, 'POST', '/transaction_delete', {
							id: cleanParams.id,
						});
						return JSON.stringify(
							wrapSuccess(resource, operation, {
								id: cleanParams.id,
								deleted: true,
							}, names.main),
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
								undefined,
								names.main,
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
						undefined,
						names.main,
					),
				);
		}
	} catch (error) {
		// Unknown tag name: same precise, model-recoverable envelope in
		// EVERY transaction branch (getAll AND aggregate) — one handler here.
		if (error instanceof TagResolutionError) {
			return JSON.stringify(
				wrapError(
					resource,
					operation,
					ERROR_TYPES.NO_RESULTS_FOUND,
					error.message,
					error.candidates.length
						? `Closest tag names: ${error.candidates.join(', ')}. Use one of these exactly.`
						: 'Call buxfer_listTags_transaction for available tag names.',
					{ candidates: error.candidates },
					names.main,
				),
			);
		}
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
					undefined,
					names.main,
				),
			);
		}

		return JSON.stringify(
			formatApiError(resource, operation, (error as Error).message, names.main),
		);
	}
}
