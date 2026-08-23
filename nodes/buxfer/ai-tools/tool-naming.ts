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
 * So every name is derived from the node's own name, which n8n keeps unique
 * within a workflow: `<resource>_<node name>`, `listAccounts_<node name>`, …
 * Renaming a node renames its tools, exactly as n8n's collision error suggests
 * ("please rename them to avoid conflicts").
 *
 * The catch is that tool names may only contain [A-Za-z0-9_-], and sanitizing
 * a node name into that alphabet is NOT injective: "Buxfer Expenses" and
 * "Buxfer_Expenses" are two legal, distinct node names that both sanitize to
 * "Buxfer_Expenses". Truncation to the 64-char budget loses information too.
 * Unique node names therefore do not imply unique tool names on their own, so
 * names are split into two provably disjoint sets:
 *
 *   canonical — only [A-Za-z0-9-] plus single interior spaces, and short
 *     enough to fit the budget. Over that set, replacing " " with "_" is a
 *     bijection (a canonical name contains no underscore and no double space),
 *     so distinct canonical names always yield distinct tool names. These get
 *     a clean, hash-free name. The node's own default name ("Buxfer AI Tools")
 *     and anything a user would normally type land here — the common case.
 *
 *   everything else — sanitized, then suffixed with "__" + a discriminator
 *     derived from node.id, the UUID n8n assigns per node instance. The id is
 *     unique no matter how the name is written, which is the point: hashing a
 *     colliding *name* again would not separate the collision. A canonical
 *     result can never contain "__", so a suffixed name can never equal a
 *     canonical one, and two suffixed names differ by their node id.
 *
 * The result is collision-free by construction, per node, with no inspection
 * of the surrounding workflow — so it holds identically in supplyData(), in
 * execute(), and across separate agents. (Sibling lookup was considered and
 * rejected: the context-level getChildNodes() takes no connectionType, so a
 * tool cannot walk its ai_tool edge to the agent, and NodeTypeAndVersion
 * carries no id, so sibling instances could not be told apart anyway.)
 */
import crypto from 'crypto';
import type { INode } from 'n8n-workflow';

/**
 * OpenAI caps tool names at 64 characters; MCP allows 128. We stay within the
 * stricter OpenAI limit so the tools work on every model provider.
 */
export const MAX_TOOL_NAME_LENGTH = 64;

/**
 * Reduce a node name to the tool-name alphabet, using the same rule as n8n's
 * own nodeNameToToolName. Inlined rather than imported from n8n-workflow: the
 * disjointness argument above depends on the exact mapping, so it should not
 * shift under us on an n8n upgrade (and the names are ours, not n8n's, so
 * matching its output buys nothing). Lossy on purpose — callers must pair it
 * with the node-id discriminator below, never rely on it to keep names apart.
 */
export function sanitizeNodeName(name: string): string {
	return name.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

/**
 * Node names that sanitize losslessly: [A-Za-z0-9-] words separated by single
 * spaces. No underscore, no repeated/leading/trailing separator — so " "→"_"
 * is reversible and cannot alias another canonical name.
 */
const CANONICAL_NODE_NAME = /^[a-zA-Z0-9-]+(?: [a-zA-Z0-9-]+)*$/;

/** Characters of node id kept in the discriminator. */
const DISCRIMINATOR_CHARS = 8;
/** Total length of the `__<discriminator>` suffix. */
const DISCRIMINATOR_LENGTH = DISCRIMINATOR_CHARS + 2;

/**
 * The concrete tool names a single node instance exposes. Every name is unique
 * per node and leads with the informative part.
 */
export interface ToolNames {
	/** Main unified tool, e.g. `transaction_Buxfer_Expenses`. */
	main: string;
	/** Account discovery helper, e.g. `listAccounts_Buxfer_Expenses`. */
	listAccounts: string;
	/** Tag discovery helper, e.g. `listTags_Buxfer_Expenses`. */
	listTags: string;
}

/**
 * Per-instance discriminator: the leading alphanumerics of node.id, the UUID
 * n8n assigns to each node (so it stays greppable in the workflow JSON).
 * Falls back to a hash of the node name for a hand-written workflow whose node
 * carries no usable id — node names are workflow-unique, so that stays unique.
 */
function nodeDiscriminator(node: INode): string {
	const fromId = (node.id ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, DISCRIMINATOR_CHARS);
	if (fromId.length === DISCRIMINATOR_CHARS) return fromId;
	return crypto
		.createHash('sha1')
		.update(node.name, 'utf8')
		.digest('hex')
		.slice(0, DISCRIMINATOR_CHARS);
}

/**
 * Compose `<prefix><node name>` within MAX_TOOL_NAME_LENGTH. Canonical names
 * that fit are used as-is (spaces to underscores); everything else — ambiguous
 * punctuation, or too long to survive intact — is sanitized, trimmed to fit and
 * tagged with `__<node id>`, which no canonical result can reproduce.
 */
function withNodeSuffix(prefix: string, node: INode): string {
	const name = node.name;
	const budget = MAX_TOOL_NAME_LENGTH - prefix.length;
	if (name.length <= budget && CANONICAL_NODE_NAME.test(name)) {
		return `${prefix}${name.replace(/ /g, '_')}`;
	}
	// ponytail: the prefixes are short fixed literals (<= 13 chars), so the stem
	// budget is always comfortably positive; the clamp just stops a pathological
	// prefix from slicing negatively rather than pretending to handle it.
	const stem = sanitizeNodeName(name)
		.slice(0, Math.max(0, budget - DISCRIMINATOR_LENGTH))
		.replace(/[_-]+$/, '');
	return `${prefix}${stem}__${nodeDiscriminator(node)}`;
}

/** Build the full set of tool names for a node instance and resource. */
export function buildToolNames(node: INode, resource: string): ToolNames {
	// No "buxfer_" prefix: the node name already carries the Buxfer branding
	// (e.g. "Buxfer Expenses"), so prefixing would duplicate it. The resource is
	// the functional identifier; the node name is the instance disambiguator.
	// The prefixes below are pairwise prefix-free, so names built from different
	// prefixes cannot collide either.
	return {
		main: withNodeSuffix(`${resource}_`, node),
		listAccounts: withNodeSuffix('listAccounts_', node),
		listTags: withNodeSuffix('listTags_', node),
	};
}
