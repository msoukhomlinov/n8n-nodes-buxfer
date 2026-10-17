/**
 * Runtime class resolver for Buxfer AI Tools.
 *
 * Community nodes bundle their own `zod` and `@langchain/core`. At runtime n8n
 * loads its own copies. JavaScript `instanceof` fails across module copies.
 * This module resolves both classes from n8n's module tree using `createRequire()`.
 *
 * Resolution order:
 * DynamicStructuredTool: require.main (realpath'd) → filesystem anchor → cached-tree scan
 * zod: the copy n8n's own converters `instanceof`-check against, i.e. the zod
 * that `@n8n/ai-utilities` (AI agent / AI tool path) and `zod-to-json-schema`
 * (MCP trigger path) resolve — then the `@langchain/core/tools` module's own
 * directory as legacy fallback → independent fallbacks
 *
 * Why the consumer copy wins: n8n's converters (`getParametersJsonSchema` in
 * @n8n/ai-utilities, `zodToJsonSchema` in the MCP trigger) test
 * `schema instanceof ZodSchema` against THEIR own zod copy. A schema built
 * from any other copy — e.g. `@langchain/core`'s private nested `zod` (which
 * the old tools-module-path rule pinned, and which is zod v4 on n8n ≥ 2.x
 * while the converters use the hoisted zod v3) — fails that check and the
 * converter silently degrades the inputSchema to an empty/garbage object.
 * The LLM then sees no parameters and no descriptions and loops. Resolving
 * zod from the consumer packages' own trees replays the exact
 * `require('zod')` walk each converter performs, so `instanceof` passes.
 *
 * `require.main` is realpath'd first: npm/homebrew global bin shims
 * (e.g. /opt/homebrew/bin/n8n) live outside any node_modules tree, so a
 * require bound to the shim path cannot reach the n8n package tree at all;
 * the shim's real target (…/node_modules/n8n/dist/…) can.
 */
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
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

const LANGCHAIN_TREE_PATTERNS = [
	'@n8n/n8n-nodes-langchain',
	'@n8n/ai-utilities',
	'@langchain/classic',
	'n8n',
] as const;

const ZOD_TREE_PATTERNS = [
	'@n8n/n8n-nodes-langchain',
	'@n8n/ai-utilities',
	'n8n-workflow',
	'n8n-core',
	'n8n',
] as const;

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

function packageKeyPattern(pkg: string): RegExp {
	const parts = pkg.split('/').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	return new RegExp(`[\\\\/]${parts.join('[\\\\/]')}[\\\\/]`);
}

/** Scans require.cache for a module belonging to one of `patterns` that can resolve `id`. */
function findCachedTreeAnchor(
	patterns: readonly string[],
	id: string,
): { req: RuntimeRequire; resolved: unknown; resolvedPath: string } | undefined {
	const cache = require.cache;
	if (!cache) return undefined;
	const keys = Object.keys(cache);
	for (const pkg of patterns) {
		const anchorPattern = packageKeyPattern(pkg);
		for (const key of keys) {
			if (key.includes(OWN_PACKAGE_NAME)) continue;
			if (!anchorPattern.test(key)) continue;
			try {
				const anchorReq = createRequire(key) as RuntimeRequire;
				const resolvedPath = anchorReq.resolve(id);
				const resolved = anchorReq(id);
				if (resolved) return { req: anchorReq, resolved, resolvedPath };
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
		// Realpath first: npm/homebrew global bin shims are not inside any
		// node_modules tree, so a require bound to the shim path cannot reach
		// the n8n package tree; the shim's real target can.
		return createRequire(realpathSync(mainFile));
	} catch {
		try {
			return createRequire(mainFile);
		} catch {
			return null;
		}
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
/** Resolved filesystem path of `@langchain/core/tools`; legacy zod fallback resolves from a require bound to THIS path. */
let _toolsModulePath: string | undefined;
/** Require bound to the n8n-tree file that loaded the tools module — used to resolve the zod copies of n8n's own converter packages. */
let _toolsAnchorReq: RuntimeRequire | undefined;
let langchainResolutionDiagnostic: string | null = null;
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
			const toolsPath = _mainReq.resolve('@langchain/core/tools');
			if (!toolsPath.includes(OWN_PACKAGE_NAME)) {
				const ctor = extractDynamicStructuredTool(_mainReq('@langchain/core/tools'));
				if (ctor) {
					_RuntimeDynamicStructuredTool = ctor;
					_toolsModulePath = toolsPath;
					_toolsAnchorReq = _mainReq;
					langchainLoadError = null;
					langchainResolutionDiagnostic = 'resolved via require.main';
					return ctor;
				}
			}
		} catch (e) {
			langchainLoadError = e instanceof Error ? e.message : String(e);
		}
	}

	if (_filesystemAnchorReq) {
		try {
			const toolsPath = _filesystemAnchorReq.resolve('@langchain/core/tools');
			if (!toolsPath.includes(OWN_PACKAGE_NAME)) {
				const ctor = extractDynamicStructuredTool(_filesystemAnchorReq('@langchain/core/tools'));
				if (ctor) {
					_RuntimeDynamicStructuredTool = ctor;
					_toolsModulePath = toolsPath;
					_toolsAnchorReq = _filesystemAnchorReq;
					langchainLoadError = null;
					langchainResolutionDiagnostic = _anchorDiagnostic ?? 'resolved via filesystem anchor';
					return ctor;
				}
			}
		} catch (e) {
			langchainLoadError = e instanceof Error ? e.message : String(e);
		}
	}

	try {
		const cached = findCachedTreeAnchor(LANGCHAIN_TREE_PATTERNS, '@langchain/core/tools');
		const ctor = cached ? extractDynamicStructuredTool(cached.resolved) : undefined;
		if (ctor && cached) {
			_RuntimeDynamicStructuredTool = ctor;
			_toolsModulePath = cached.resolvedPath;
			_toolsAnchorReq = cached.req;
			langchainLoadError = null;
			langchainResolutionDiagnostic = 'resolved via n8n-owned-tree anchor (pnpm-isolated install)';
			return ctor;
		}
	} catch (e) {
		langchainLoadError = e instanceof Error ? e.message : String(e);
	}

	return undefined;
}

/**
 * Resolve the zod copy that n8n's own converters check `instanceof` against:
 * `@n8n/ai-utilities` (AI agent / AI tool path) and `zod-to-json-schema`
 * (MCP trigger path). Each is probed with a require bound to that package's
 * own resolved file, replaying the exact `require('zod')` walk the package
 * performs internally. In a normal n8n install both resolve to the same
 * hoisted zod; if they ever diverge, the ai-utilities copy wins (the agent
 * path is the primary consumer).
 */
function resolveConsumerZod(): ZodNamespace | undefined {
	if (!_toolsAnchorReq) return undefined;
	for (const consumer of ['@n8n/ai-utilities', 'zod-to-json-schema'] as const) {
		try {
			const consumerPath = _toolsAnchorReq.resolve(consumer);
			if (consumerPath.includes(OWN_PACKAGE_NAME)) continue;
			const consumerReq = createRequire(consumerPath) as RuntimeRequire;
			const zodPath = consumerReq.resolve('zod');
			if (zodPath.includes(OWN_PACKAGE_NAME)) continue;
			const mod = consumerReq('zod');
			if (isZodNamespace(mod)) {
				_runtimeZod = mod;
				zodLoadError = null;
				zodResolutionDiagnostic = `resolved via ${consumer} consumer copy`;
				return mod;
			}
		} catch (e) {
			// Package not present in this n8n version — try the next consumer.
			zodLoadError = e instanceof Error ? e.message : String(e);
		}
	}
	return undefined;
}

function resolveRuntimeZod(): ZodNamespace | undefined {
	if (_runtimeZod) return _runtimeZod;

	// Resolve DynamicStructuredTool first so `_toolsAnchorReq` is populated.
	resolveDynamicStructuredTool();

	// Consumer copy first — this is the copy n8n's converters instanceof-check
	// against, so a schema built from it survives every conversion path.
	const consumerZod = resolveConsumerZod();
	if (consumerZod) return consumerZod;

	// Legacy fallback: zod from the `@langchain/core/tools` module's own
	// directory (replays @langchain/core's internal require('zod')). Only
	// correct when @langchain/core shares a zod copy with n8n's converters
	// — true for older n8n versions without private nested copies.
	if (_toolsModulePath) {
		try {
			const toolsModuleReq = createRequire(_toolsModulePath) as RuntimeRequire;
			const zodPath = toolsModuleReq.resolve('zod');
			if (!zodPath.includes(OWN_PACKAGE_NAME)) {
				const mod = toolsModuleReq('zod');
				if (isZodNamespace(mod)) {
					_runtimeZod = mod;
					zodLoadError = null;
					zodResolutionDiagnostic = `resolved via @langchain/core/tools module path (${langchainResolutionDiagnostic ?? 'unknown'})`;
					return mod;
				}
			}
		} catch (e) {
			zodLoadError = e instanceof Error ? e.message : String(e);
		}
	}

	// Independent fallbacks — only reached if the tools module path is unavailable or
	// can't resolve zod itself. Best-effort; may not match the LangChain module tree.
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
		const cached = findCachedTreeAnchor(ZOD_TREE_PATTERNS, 'zod');
		if (cached && isZodNamespace(cached.resolved)) {
			_runtimeZod = cached.resolved;
			zodLoadError = null;
			zodResolutionDiagnostic = 'resolved via n8n-owned-tree anchor (pnpm-isolated install)';
			return cached.resolved;
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
						(_anchorDiagnostic ? ` Filesystem anchor probe: ${_anchorDiagnostic}` : '') +
						(langchainLoadError ? ` Load error: ${langchainLoadError}` : ''),
				);
			}
			return new (ctor as any)(...args) as object;
		},
		get(_target, prop) {
			if (typeof prop === 'symbol' || prop === 'then' || prop === 'constructor') {
				return undefined;
			}
			const ctor = resolveDynamicStructuredTool();
			return ctor ? (ctor as any)[prop] : undefined;
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
