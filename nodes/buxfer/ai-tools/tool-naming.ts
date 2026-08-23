/**
 * Tool name derivation for Buxfer AI Tools.
 *
 * n8n's agent enforces unique tool names across every tool connected to it
 * (getConnectedTools throws "You have multiple tools with the same name").
 * Names are scoped by resource — `buxfer_{resource}`, `buxfer_listAccounts_{resource}`,
 * `buxfer_listTags_{resource}` — so two Buxfer AI Tools nodes with different
 * resources never collide.
 *
 * Two nodes configured with the SAME resource still collide: n8n's own
 * duplicate-tool-name error fires, telling the user to rename. That's accepted —
 * this node doesn't support two working instances of the same resource on one
 * agent, and deriving names from the node name to work around it isn't worth
 * the complexity (see git history on this file for the previous attempt).
 */
export interface ToolNames {
	/** Main unified tool, e.g. `buxfer_transaction`. */
	main: string;
	/** Account discovery helper, e.g. `buxfer_listAccounts_transaction`. */
	listAccounts: string;
	/** Tag discovery helper, e.g. `buxfer_listTags_transaction`. */
	listTags: string;
}

/** Build the full set of tool names for a resource. */
export function buildToolNames(resource: string): ToolNames {
	return {
		main: `buxfer_${resource}`,
		listAccounts: `buxfer_listAccounts_${resource}`,
		listTags: `buxfer_listTags_${resource}`,
	};
}
