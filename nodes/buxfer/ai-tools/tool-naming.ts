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
 * We deliberately do NOT append a generated counter/hash: the node name carries
 * the meaning, and a well-named node yields a fully descriptive tool name.
 */
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

/**
 * Compose `<prefix><sanitized node name>`, truncating the node-name suffix so
 * the total never exceeds MAX_TOOL_NAME_LENGTH. The prefix always ends in an
 * underscore; if the suffix is empty the trailing underscore is dropped.
 */
function withNodeSuffix(prefix: string, node: INode): string {
	const suffix = sanitizeNodeName(node.name);
	const budget = MAX_TOOL_NAME_LENGTH - prefix.length;
	if (budget <= 0) return prefix.slice(0, MAX_TOOL_NAME_LENGTH);
	let s = suffix;
	if (s.length > budget) s = s.slice(0, budget).replace(/[_-]+$/, '');
	return s ? `${prefix}${s}` : prefix.replace(/[_-]+$/, '');
}

/** Build the full set of tool names for a node instance and resource. */
export function buildToolNames(node: INode, resource: string): ToolNames {
	return {
		main: withNodeSuffix(`buxfer_${resource}_`, node),
		listAccounts: withNodeSuffix('buxfer_listAccounts_', node),
		listTags: withNodeSuffix('buxfer_listTags_', node),
	};
}
