/**
 * Runtime class resolver for Buxfer AI Tools.
 *
 * Community nodes bundle their own `zod` and `@langchain/core`. At runtime n8n
 * loads its own copies. JavaScript `instanceof` fails across module copies.
 * This module resolves both classes from n8n's module tree using `createRequire()`.
 *
 * Resolution order:
 * DynamicStructuredTool: require.main → filesystem anchor → requireFromCachedTree
 * zod: require.main → filesystem anchor (same @langchain tree) → requireFromCachedTree
 *
 * zod must be resolved from the LangChain filesystem anchor before falling back to
 * generic n8n-owned packages — n8n-workflow is already in require.cache (this node
 * imports it) and may pin a different zod copy than @langchain/core expects.
 */
import { createRequire } from 'node:module';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import type { z as zodNamespace } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DynamicStructuredToolCtor = typeof DynamicStructuredTool;
type ZodNamespace = typeof zodNamespace;
type RuntimeRequire = { (moduleId: string): unknown; resolve(id: string): string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const OWN_PACKAGE_NAME = 'n8n-nodes-buxfer';

const ANCHOR_CANDIDATES = ['@langchain/classic/agents', 'langchain/agents'] as const;

const LANGCHAIN_TREE_PATTERNS = ['@n8n/n8n-nodes-langchain', '@langchain/classic'] as const;

const ZOD_TREE_PATTERNS = ['@n8n/n8n-nodes-langchain', 'n8n-workflow', 'n8n-core'] as const;

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

function packageKeyPattern(pkg: string): RegExp {
	const parts = pkg.split('/').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	return new RegExp(`[\\\\/]${parts.join('[\\\\/]')}[\\\\/]`);
}

function requireFromCachedTree(patterns: readonly string[], id: string): unknown {
	const cache = require.cache;
	if (!cache) return undefined;
	const keys = Object.keys(cache);
	for (const pkg of patterns) {
		const anchorPattern = packageKeyPattern(pkg);
		for (const key of keys) {
			if (key.includes(OWN_PACKAGE_NAME)) continue;
			if (!anchorPattern.test(key)) continue;
			try {
				const anchorReq = createRequire(key);
				const resolved = anchorReq(id);
				if (resolved) return resolved;
			} catch {
				// This cached module can't reach `id`; try the next cached key / pattern.
			}
		}
	}
	return undefined;
}

function getMainRequire(): RuntimeRequire | null {
	const mainFile = require.main?.filename;
	if (!mainFile) return null;
	try {
		return createRequire(mainFile);
	} catch {
		return null;
	}
}

function getFilesystemAnchorRequire(): { runtimeReq: RuntimeRequire | null; diagnostic: string | null } {
	const tried: string[] = [];
	for (const anchor of ANCHOR_CANDIDATES) {
		try {
			const anchorPath = require.resolve(anchor) as string;
			return {
				runtimeReq: createRequire(anchorPath),
				diagnostic: `resolved via filesystem anchor: ${anchor}`,
			};
		} catch (e) {
			tried.push(`${anchor}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
	return {
		runtimeReq: null,
		diagnostic:
			`[BuxferAiTools] No filesystem anchor. Tried: ${ANCHOR_CANDIDATES.join(', ')}. ` +
			`Errors: ${tried.join(' | ')}`,
	};
}

const _mainReq = getMainRequire();
const { runtimeReq: _filesystemAnchorReq, diagnostic: _anchorDiagnostic } =
	getFilesystemAnchorRequire();

let _RuntimeDynamicStructuredTool: DynamicStructuredToolCtor | undefined;
let _runtimeZod: ZodNamespace | undefined;
let langchainResolutionDiagnostic: string | null = _anchorDiagnostic;
let zodResolutionDiagnostic: string | null = null;
let langchainLoadError: string | null = null;
let zodLoadError: string | null = null;

function extractDynamicStructuredTool(mod: unknown): DynamicStructuredToolCtor | undefined {
	const rec = mod as Record<string, unknown> | undefined;
	return typeof rec?.['DynamicStructuredTool'] === 'function'
		? (rec['DynamicStructuredTool'] as DynamicStructuredToolCtor)
		: undefined;
}

function isZodNamespace(mod: unknown): mod is ZodNamespace {
	const rec = mod as Record<string, unknown> | undefined;
	return typeof rec?.['ZodType'] === 'function' && typeof rec?.['object'] === 'function';
}

function resolveDynamicStructuredTool(): DynamicStructuredToolCtor | undefined {
	if (_RuntimeDynamicStructuredTool) return _RuntimeDynamicStructuredTool;

	if (_mainReq) {
		try {
			const ctor = extractDynamicStructuredTool(_mainReq('@langchain/core/tools'));
			if (ctor) {
				_RuntimeDynamicStructuredTool = ctor;
				langchainLoadError = null;
				langchainResolutionDiagnostic = 'resolved via require.main';
				return ctor;
			}
		} catch (e) {
			langchainLoadError = e instanceof Error ? e.message : String(e);
		}
	}

	if (_filesystemAnchorReq) {
		try {
			const ctor = extractDynamicStructuredTool(_filesystemAnchorReq('@langchain/core/tools'));
			if (ctor) {
				_RuntimeDynamicStructuredTool = ctor;
				langchainLoadError = null;
				langchainResolutionDiagnostic = _anchorDiagnostic ?? 'resolved via filesystem anchor';
				return ctor;
			}
		} catch (e) {
			langchainLoadError = e instanceof Error ? e.message : String(e);
		}
	}

	try {
		const ctor = extractDynamicStructuredTool(
			requireFromCachedTree(LANGCHAIN_TREE_PATTERNS, '@langchain/core/tools'),
		);
		if (ctor) {
			_RuntimeDynamicStructuredTool = ctor;
			langchainLoadError = null;
			langchainResolutionDiagnostic =
				'resolved via n8n-owned-tree anchor (pnpm-isolated install)';
			return ctor;
		}
	} catch (e) {
		langchainLoadError = e instanceof Error ? e.message : String(e);
	}

	return undefined;
}

function resolveRuntimeZod(): ZodNamespace | undefined {
	if (_runtimeZod) return _runtimeZod;

	if (_mainReq) {
		try {
			const zodPath = _mainReq.resolve('zod');
			if (!zodPath.includes(OWN_PACKAGE_NAME)) {
				const mod = _mainReq('zod');
				if (isZodNamespace(mod)) {
					_runtimeZod = mod;
					zodLoadError = null;
					zodResolutionDiagnostic = 'resolved via require.main';
					return mod;
				}
			}
		} catch (e) {
			zodLoadError = e instanceof Error ? e.message : String(e);
		}
	}

	if (_filesystemAnchorReq) {
		try {
			const zodPath = _filesystemAnchorReq.resolve('zod');
			if (!zodPath.includes(OWN_PACKAGE_NAME)) {
				const mod = _filesystemAnchorReq('zod');
				if (isZodNamespace(mod)) {
					_runtimeZod = mod;
					zodLoadError = null;
					zodResolutionDiagnostic = _anchorDiagnostic ?? 'resolved via filesystem anchor';
					return mod;
				}
			}
		} catch (e) {
			zodLoadError = e instanceof Error ? e.message : String(e);
		}
	}

	try {
		const mod = requireFromCachedTree(ZOD_TREE_PATTERNS, 'zod');
		if (isZodNamespace(mod)) {
			_runtimeZod = mod;
			zodLoadError = null;
			zodResolutionDiagnostic = 'resolved via n8n-owned-tree anchor (pnpm-isolated install)';
			return mod;
		}
	} catch (e) {
		zodLoadError = e instanceof Error ? e.message : String(e);
	}

	return undefined;
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
			const ctor = resolveDynamicStructuredTool();
			if (!ctor) {
				throw new Error(
					'[BuxferAiTools] DynamicStructuredTool could not be resolved from n8n runtime. ' +
						'Ensure @langchain/core is installed in the n8n environment.' +
						(langchainResolutionDiagnostic ? ` Diagnostic: ${langchainResolutionDiagnostic}` : '') +
						(langchainLoadError ? ` Load error: ${langchainLoadError}` : ''),
				);
			}
			return new (ctor as any)(...args) as object;
		},
		get(_target, prop) {
			const ctor = resolveDynamicStructuredTool();
			if (ctor) {
				return (ctor as any)[prop];
			}
			return undefined;
		},
	},
) as DynamicStructuredToolCtor;

export const runtimeZod: ZodNamespace = new Proxy({} as ZodNamespace, {
	get(_target, prop) {
		if (typeof prop === 'symbol' || prop === 'then' || prop === 'constructor') {
			return undefined;
		}
		const zod = resolveRuntimeZod();
		if (!zod) {
			throw new Error(
				`[BuxferAiTools] zod could not be resolved from n8n runtime (accessing .${String(prop)}). ` +
					'Ensure zod is installed in the n8n environment.' +
					(zodResolutionDiagnostic ? ` Diagnostic: ${zodResolutionDiagnostic}` : '') +
					(zodLoadError ? ` Load error: ${zodLoadError}` : ''),
			);
		}
		return (zod as any)[prop];
	},
});
