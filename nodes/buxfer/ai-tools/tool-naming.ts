/**
 * Tool name derivation for Buxfer AI Tools.
 *
 * n8n's agent enforces unique tool names across every tool connected to it
 * (getConnectedTools throws "You have multiple tools with the same name").
 * Each Buxfer AI Tools node exposes a main tool PLUS shared discovery helpers
 * (list accounts / list tags), so two nodes on the same agent collide on the
 * helper names regardless of resource — and on the main name when the resource
 * matches too.
 *
 * Fix: derive every tool name from the node name, the same idiom n8n's own
 * "Call n8n Sub-Workflow Tool" node uses (nodeNameToToolName). The resource is
 * kept as the primary, informative identifier and the node name is the instance
 * disambiguator — so renaming a node renames its tools, which is exactly what
 * the n8n collision error suggests ("please rename them to avoid conflicts").
 * We deliberately do NOT append a generated counter: the node name carries the
 * meaning, and a well-named node yields a fully descriptive tool name. A short
 * hash of the full original name is appended only as a last-resort
 * discriminator — when sanitization altered the name (punctuation/spacing
 * variants collapse to the same string) or the name must be truncated (two
 * distinct names sharing a long prefix would otherwise collide).
 */
import crypto from 'crypto';
import type { INode } from 'n8n-workflow';
import * as n8nWorkflow from 'n8n-workflow';

/**
 * OpenAI caps tool names at 64 characters; MCP allows 128. We stay within the
 * stricter OpenAI limit so the tools work on every model provider.
 */
export const MAX_TOOL_NAME_LENGTH = 64;

/**
 * n8n exports nodeNameToToolName from newer n8n-workflow builds. We access it
 * defensively so older versions (which lack the export) still work via the
 * identical local fallback below.
 */
const n8nNodeNameToToolName = (
	n8nWorkflow as Record<string, unknown>
).nodeNameToToolName;

function localNodeNameToToolName(name: string): string {
	let toolName = name.replace(/[^a-zA-Z0-9_-]+/g, '_');
	if (toolName.length > MAX_TOOL_NAME_LENGTH) {
		toolName = toolName.slice(0, MAX_TOOL_NAME_LENGTH).replace(/[_-]+$/, '');
	}
	return toolName;
}

/** Sanitize a node name into a valid, informative tool-name fragment. */
export function sanitizeNodeName(name: string): string {
	if (typeof n8nNodeNameToToolName === 'function') {
		return (n8nNodeNameToToolName as (n: string) => string)(name);
	}
	return localNodeNameToToolName(name);
}

/**
 * The concrete tool names a single node instance exposes. Every name is unique
 * per node (via the node-name suffix) and leads with the informative part.
 */
export interface ToolNames {
	/** Main unified tool, e.g. `transaction_Buxfer_Expenses`. */
	main: string;
	/** Account discovery helper, e.g. `listAccounts_Buxfer_Expenses`. */
	listAccounts: string;
	/** Tag discovery helper, e.g. `listTags_Buxfer_Expenses`. */
	listTags: string;
}

/** Length of the `_<hash>` discriminator appended to truncated names. */
const NAME_HASH_LENGTH = 8;
/** Total length of the `_<hash>` discriminator, underscore included. */
const DISCRIMINATOR_LENGTH = NAME_HASH_LENGTH + 1;

/**
 * Short stable discriminator (8 lowercase hex chars) for a node name.
 *
 * Hashes the FULL original name — before sanitization — so names that differ
 * only in punctuation or spacing (which sanitization collapses) still get
 * distinct discriminators. Deterministic across runs and machines.
 */
function nodeNameHash(name: string): string {
	return crypto
		.createHash('sha1')
		.update(name, 'utf8')
		.digest('hex')
		.slice(0, NAME_HASH_LENGTH);
}

/**
 * Compose `<prefix><sanitized node name>`, keeping the total within
 * MAX_TOOL_NAME_LENGTH. The prefix always ends in an underscore; if the
 * sanitized suffix is empty the trailing underscore is dropped.
 *
 * The sanitized name is kept exactly as-is (purely informative, no extra
 * suffix) only when it is already in canonical form — sanitization left it
 * unchanged — AND it fits the budget. Otherwise a short stable hash of the
 * FULL original node name is appended: `<prefix><truncatedName>_<hash>`.
 * The hash is needed whenever sanitization altered the name (punctuation and
 * spacing variants collapse to the same string, e.g. "Buxfer Expenses" and
 * "Buxfer_Expenses") or the name must be truncated (the distinguishing tail
 * would be discarded, so two distinct names sharing a long prefix would
 * collide). The hash of the full original name captures both cases, and the
 * total length still never exceeds MAX_TOOL_NAME_LENGTH.
 */
function withNodeSuffix(prefix: string, node: INode): string {
	const original = node.name;
	const suffix = sanitizeNodeName(original);
	const budget = MAX_TOOL_NAME_LENGTH - prefix.length;
	if (budget <= 0) return prefix.slice(0, MAX_TOOL_NAME_LENGTH);
	if (!suffix) return prefix.replace(/[_-]+$/, '');
	// A name is unambiguous only when sanitization left it unchanged (already
	// canonical) AND it fits the budget. Otherwise two distinct node names can
	// map to the same suffix (sanitization collapses punctuation/spacing
	// variants; truncation discards the tail) — append a stable hash of the
	// FULL original name so the tool names stay unique.
	const needsDiscriminator = suffix !== original || suffix.length > budget;
	if (!needsDiscriminator) return `${prefix}${suffix}`;
	const hash = nodeNameHash(original);
	const nameBudget = budget - DISCRIMINATOR_LENGTH;
	if (nameBudget <= 0) return `${prefix}${hash.slice(0, budget)}`;
	const truncated = suffix.slice(0, nameBudget).replace(/[_-]+$/, '');
	const s = truncated ? `${truncated}_${hash}` : hash;
	return `${prefix}${s}`;
}

/** Build the full set of tool names for a node instance and resource. */
export function buildToolNames(node: INode, resource: string): ToolNames {
	// No "buxfer_" prefix: the node name already carries the Buxfer branding
	// (e.g. "Buxfer Expenses"), so prefixing would duplicate it. The resource is
	// the functional identifier; the node name is the instance disambiguator.
	return {
		main: withNodeSuffix(`${resource}_`, node),
		listAccounts: withNodeSuffix('listAccounts_', node),
		listTags: withNodeSuffix('listTags_', node),
	};
}
