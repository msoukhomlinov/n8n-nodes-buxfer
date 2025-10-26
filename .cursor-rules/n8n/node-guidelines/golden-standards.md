# Golden Standard for n8n Community Nodes (v1.0)

This section defines our opinionated framework for building future n8n community nodes, using the current `n8n-nodes-autotask` repository as the reference implementation. It covers directory layout, coding standards, n8n compatibility, and placement of `resources`, `operations`, `constants`, `helpers`, and debug/logging.

## Objectives
- Ensure consistent, scalable structure across all nodes
- Maximise editor performance and UX (declarative descriptions + programmatic execute)
- Provide robust error handling, rate limiting, caching, and pagination
- Simplify testability and onboarding

## Target compatibility
- **Node.js**: >= 18.10 (match `package.json` `engines.node`)
- **n8n Nodes API**: `n8n.n8nNodesApiVersion: 1` in `package.json`
- **Peer**: `n8n-workflow >= 1.0.0` (prefer keeping devDependency aligned to latest minor used for development, e.g. `^1.70.0` at time of this baseline)

## Directory structure (required)

Top-level:
- `credentials/` – One file per credential (`*.credentials.ts`), no cross-node coupling.
- `nodes/<Product>/` – One product folder containing the node implementation.
- `nodes/<Product>/<Product>.node.ts` – Main node registering resources and delegating execute.
- `nodes/<Product>/<Product>Trigger.node.ts` – Trigger node (optional, if applicable).
- `nodes/<Product>/resources/` – Resource-level description/execute split per entity.
- `nodes/<Product>/operations/` – Cross-resource reusable operations (base/common), including field processors.
- `nodes/<Product>/helpers/` – HTTP, error handling, caching, pagination, options, entity mapping, date-time, UDF and webhook helpers. Group by subdomain (`http/`, `entity/`, `entity-values/`, `field-conversion/`, `udf/`, `webhook/`, `options/`, `cache/`).
- `nodes/<Product>/constants/` – API constants, date formats, entities metadata, UI labels/messages, filters, and operation constraints. Provide a single `index.ts` re-export.
- `nodes/<Product>/types/` – Shared TS types. Subdivide into `base/` for common API primitives.
- `dist/` – Build artefacts only.

Per-resource structure under `resources/<entity>/`:
- `description.ts` – Declarative UI parameters, operations, and fields for the entity.
- `execute.ts` – Programmatic execute handlers for that entity (CRUD, query, etc.).

## Node base file responsibilities
- Keep `properties` declarative by composing from each resource’s `description.ts` using a helper like `addOperationsToResource`.
- Route execute via a simple `switch (resource)` dispatch to each resource’s `execute` function.
- Provide `methods.loadOptions` only for reusable dynamic options (avoid heavy computations; use caching where appropriate).
- Use module-scope caches for UI-only metadata where safe to reduce chatter in the Editor.

### Parameters and options conventions (n8n best practice)
- Define a top-level `resource` parameter:
- `type: 'options'`, `required: true`, `default: ''`, `noDataExpression: true`.
- Options built from a typed definition list (e.g. `RESOURCE_DEFINITIONS`).
- Define an `operation` parameter per resource section:
- `type: 'options'`, `required: true`, `default: ''`, `noDataExpression: true`.
- Gate by `displayOptions.show: { resource: ['...'] }` to ensure only one visible at a time.
- Reuse internal option `value` identifiers across operations to preserve user data when switching operations; when reusing, ensure only one field with that `name` is visible at any time using `displayOptions`.
- Prefer consistent option shapes: include a concise `description`, an `action` phrase for operation options, and sort options alphabetically for predictability.
- Where appropriate, set `noDataExpression: true` on options to avoid expression evaluation for structural selectors like `resource` and `operation`.
- Use `displayOptions` to conditionally reveal parameters relevant to the selected operation; avoid overlapping visibility for fields sharing the same internal name.

## Helpers (required patterns)
- `helpers/http/`:
- `request.ts` – Single entry `autotaskApiRequest` responsible for URL construction, pagination URL handling, query vs modification detection, and response shape validation. Surface errors through `NodeApiError` with enriched messages.
- `headers.ts`, `rateLimit.ts`, `threadLimit.ts`, `body-builder.ts`, `initRateTracker.ts` – clear separation of concerns.
- `helpers/errorHandler.ts` – Standardised error context/type creation and `handleErrors` wrapper. Always prefer throwing `NodeOperationError` with item index.
- `helpers/cache/` – Pluggable cache service, tenant-aware, with TTLs from credentials.
- `helpers/pagination.ts` – Paginators that consume API `pageDetails` and preserve filters on subsequent pages.
- `helpers/options/` – Dynamic option loaders (entity lists, fields), calling central mappers and stripping heavy payloads for Editor.
- `helpers/entity/`, `helpers/entity-values/`, `helpers/field-conversion/` – Centralised enrichment and value formatting.

## Constants (required content)
- `constants/operations.ts` – `API_VERSION`, pagination and query limits, and date formats. Use `YYYY-MM-DDTHH:mm:ss.SSS[Z]` for UTC with `Z` suffix.
- `constants/entities.ts` – Entity metadata (pluralisation rules, subnames, attachment flags).
- `constants/ui.ts` and `ui.constants.ts` – Labels/messages in one place; export a curated surface via `constants/index.ts`.
- `constants/filters.ts` – Shared filter definitions for search builders.

## Coding standards
- TypeScript strict mode; explicit types on public APIs and exports.
- No non-null assertions. Use guards and narrow types.
- Prefer early returns and guard clauses; avoid deep nesting.
- Use `NodeOperationError`/`NodeApiError` consistently. API errors should preferentially show vendor-specific messages if present.
- Use `Number.parseFloat` over global `parseFloat`.
- Spaces for indentation; no tabs. Configure linter accordingly.
- Avoid heavy work in `loadOptions`; cache results and remove bulky fields (e.g., large picklists) from UI payloads.
- Logging: keep `console.debug` for diagnostics, avoid noisy logs in production paths. No secrets in logs.
- Paired items: for multi-item operations, preserve pairing using n8n’s paired items guidance to maintain traceability between inputs and outputs.

## Error handling policy
- Centralise API error formatting in `helpers/http/request.ts` and `helpers/errorHandler.ts`.
- Classify common statuses (401/403/404/409/422/429/5xx) to user-friendly messages; propagate API `errors[]` when available.
- Mark auth errors as non-retryable where relevant to prevent account lockouts.

## Rate limiting and concurrency
- Use a rate limiter compatible with vendor thresholds (e.g., Autotask `ThresholdInformation`).
- Enforce per-endpoint concurrency via a thread limiter to avoid 429s.
- Backoff and jitter for retries on 429/503/504; do not retry on 401/403.

## Pagination
- Preserve original filters on next-page URLs; do not duplicate `IncludeFields` if already in the URL.
- Validate shape: queries must return `items[]` and `pageDetails`.

## Credentials UX
- Group cache settings; show contextual notices when disabling cache can increase usage.
- Offer “Other (Custom URL)” zone option; compute base URL reliably.
- Provide a `preValidate` hook to reset caches on test.

## Versioning and packaging
- `package.json`:
- `n8n.n8nNodesApiVersion: 1`
- `files: ["dist"]`, `main: index.js`, `prepublishOnly: build`
- ESLint with `eslint-plugin-n8n-nodes-base` for rules; avoid TSLint going forward.
- `tsconfig.json`: strict settings; `outDir: dist`.
- Lint rules: enable core n8n rules such as `node-param-resource-without-no-data-expression`, `node-param-operation-without-no-data-expression`, stable internal values reuse, descriptive `action` on operation options, and proper `displayOptions` gating.
