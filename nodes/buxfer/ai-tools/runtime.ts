/**
 * Runtime class resolver for Buxfer AI Tools.
 *
 * Community nodes bundle their own `zod` and `@langchain/core`. At runtime n8n
 * loads its own copies. JavaScript `instanceof` fails across module copies.
 * This module resolves both classes from n8n's module tree using `createRequire()`.
 */
import { createRequire } from 'node:module';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import type { z as zodNamespace } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DynamicStructuredToolCtor = typeof DynamicStructuredTool;
type ZodNamespace = typeof zodNamespace;

// ---------------------------------------------------------------------------
// Anchor resolution
// ---------------------------------------------------------------------------
const ANCHOR_CANDIDATES = ['@langchain/classic/agents', 'langchain/agents'] as const;

let _RuntimeDynamicStructuredTool: DynamicStructuredToolCtor | undefined;
let _runtimeZod: ZodNamespace | undefined;
let _resolutionError: string | undefined;

for (const anchor of ANCHOR_CANDIDATES) {
	try {
		const runtimeRequire = createRequire(require.resolve(anchor));
		_RuntimeDynamicStructuredTool = runtimeRequire(
			'@langchain/core/tools',
		).DynamicStructuredTool as DynamicStructuredToolCtor;
		_runtimeZod = runtimeRequire('zod') as ZodNamespace;
		_resolutionError = undefined;
		break;
	} catch {
		_resolutionError = `Tried anchors: ${ANCHOR_CANDIDATES.join(', ')} — none resolved.`;
	}
}

// ---------------------------------------------------------------------------
// Exports — Proxy wrappers with deferred errors
// ---------------------------------------------------------------------------

/**
 * Proxy target MUST be `function () {}`, not `{}`.
 * Per ECMAScript §10.5.13, a Proxy only has [[Construct]] if its target does.
 */
export const RuntimeDynamicStructuredTool: DynamicStructuredToolCtor = new Proxy(
	function () {} as unknown as DynamicStructuredToolCtor,
	{
		construct(_target, args) {
			if (!_RuntimeDynamicStructuredTool) {
				throw new Error(
					`[BuxferAiTools] DynamicStructuredTool could not be resolved from n8n runtime. ${_resolutionError ?? ''}`,
				);
			}
			return new (_RuntimeDynamicStructuredTool as any)(...args) as object;
		},
		get(_target, prop) {
			if (!_RuntimeDynamicStructuredTool) return undefined;
			return (_RuntimeDynamicStructuredTool as any)[prop];
		},
	},
) as DynamicStructuredToolCtor;

export const runtimeZod: ZodNamespace = new Proxy({} as ZodNamespace, {
	get(_target, prop) {
		// Guard against symbol/thenable probes from frameworks
		if (typeof prop === 'symbol' || prop === 'then' || prop === 'constructor') {
			return undefined;
		}
		if (!_runtimeZod) {
			throw new Error(
				`[BuxferAiTools] zod could not be resolved from n8n runtime. ${_resolutionError ?? ''}`,
			);
		}
		return (_runtimeZod as any)[prop];
	},
});
