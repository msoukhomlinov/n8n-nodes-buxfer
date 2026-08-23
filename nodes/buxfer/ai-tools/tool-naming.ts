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
 * meaning, and a well-named node yields a fully descriptive tool name. Only
 * when the name is too long and must be truncated do we append a short hash of
 * the full original name — a last-resort discriminator so two distinct names
 * that share a long prefix cannot collapse into the same tool name.
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
	/** Main unified tool, e.g. `buxfer_transaction_Buxfer_Expenses`. */
	main: string;
	/** Account discovery helper, e.g. `buxfer_listAccounts_Buxfer_Expenses`. */
	listAccounts: string;
	/** Tag discovery helper, e.g. `buxfer_listTags_Buxfer_Expenses`. */
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
 * When the sanitized name fits within the budget it is kept exactly as-is —
 * purely informative, with no extra suffix. When it must be truncated, the
 * distinguishing tail would be discarded and two distinct names sharing a long
 * prefix would collide, so a short stable hash of the FULL original node name
 * is appended instead: `<prefix><truncatedName>_<hash>`. The hash also
 * captures punctuation/spacing differences that sanitization collapses, and
 * the total length still never exceeds MAX_TOOL_NAME_LENGTH.
 */
function withNodeSuffix(prefix: string, node: INode): string {
	const suffix = sanitizeNodeName(node.name);
	const budget = MAX_TOOL_NAME_LENGTH - prefix.length;
	if (budget <= 0) return prefix.slice(0, MAX_TOOL_NAME_LENGTH);
	if (!suffix) return prefix.replace(/[_-]+$/, '');
	if (suffix.length <= budget) return `${prefix}${suffix}`;

	// Truncation would discard the part that distinguishes this node from
	// another with the same long prefix — append a stable hash discriminator
	// instead so the names stay unique.
	const hash = nodeNameHash(node.name);
	const nameBudget = budget - DISCRIMINATOR_LENGTH;
	if (nameBudget <= 0) {
		// The prefix leaves room for neither the name nor the full
		// discriminator; degrade to as much of the hash as fits.
		return `${prefix}${hash.slice(0, budget)}`;
	}
	const truncated = suffix.slice(0, nameBudget).replace(/[_-]+$/, '');
	const s = truncated ? `${truncated}_${hash}` : hash;
	return `${prefix}${s}`;
}

/** Build the full set of tool names for a node instance and resource. */
export function buildToolNames(node: INode, resource: string): ToolNames {
	return {
		main: withNodeSuffix(`buxfer_${resource}_`, node),
		listAccounts: withNodeSuffix('buxfer_listAccounts_', node),
		listTags: withNodeSuffix('buxfer_listTags_', node),
	};
}
