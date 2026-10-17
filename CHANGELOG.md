# Changelog

All notable changes to the n8n-nodes-buxfer project will be documented in this file.

## [0.7.0] - 2026-10-17

### Added
- **AI Tools – `aggregate` operation for the Transaction tool**: compute spending totals in a single call instead of fetching raw transactions. `groupBy` tag, account, type, day, week or month (omit for a grand total); combines with `search`/`startDate`/`endDate`/`accountId`/`tagName`. Returns per-group `spent`/`earned`/`net`/`count` plus the largest sample transactions (`topN`, default 3) and a `coverage` block. Aggregation scans the full filtered window (paged) so totals are exact over the window — e.g. "how much did I spend on Qantas in the last 30 days?" or "total this month by tag" is now one tool call.
- **AI Tools – fuzzy search**: `getAll` `search` matches all terms case-insensitively (exact substring first). Retry with `fuzzy=true` (or it is applied automatically when an exact search finds nothing) to tolerate typos and abbreviations via near-word matching; fuzzy matches are flagged (`match: "fuzzy"`) and reported in `coverage.matchCounts`/`fuzzyFallback`.
- **AI Tools – result enrichment**: `getAll` results carry resolved `tagNames` (Buxfer returns tag IDs), so agents can answer "by category" questions without extra lookups.

### Changed
- **AI Tools – tool surface trimmed**: the `listAccounts`/`listTags` discovery helper tools are now only exposed by the Transaction resource node. Account/Tag (and other read-only resource) nodes no longer emit redundant helpers such as `buxfer_listAccounts_tag` — a 3-node setup now publishes 5 tools instead of 9.
- **AI Tools – efficiency**: transaction window scans page in parallel batches of 4 (early stop on a short page), cutting search/aggregate latency; any window scan reports `scanned`/`pages` coverage, and a bare no-filter call self-declares that it only scanned the 100 most recent transactions.
- **AI Tools – debug logging off by default**: the verbose `[Buxfer Debug]` console logging is now opt-in via the `BUXFER_DEBUG=true` environment variable.
- `aggregate` is included in the default Operations selection for the Transaction resource.

### Fixed
- **AI Tools – schema degrades fixed for n8n >= 2.x installs**: runtime zod is now resolved from the copy n8n's own converters `instanceof`-check against (consumer-copy rule), and `require.main` is realpath'd first so homebrew/npm global bin shims resolve correctly. Previously, on some layouts, the published `inputSchema` silently degraded (raw schema dump / empty object) and models could not see tool parameters.
- **AI Tools – search pagination coverage**: client-side `search` now pages through the server-filtered window (capped at 2000 transactions) instead of scanning only the first page, and reports `scanTruncated` when the cap is hit, so "not found" answers are no longer silently incomplete.
- **Security – dev toolchain**: `js-yaml` (transitive via eslint) updated 4.1.0 → 4.3.2 (CVE-2026-84375 / GHSA-2883-xcg3-v3hh) and `brace-expansion` updated 1.1.12 → 1.1.21 and 2.0.2 → 2.1.7 (CVE-2026-102277 / GHSA-q2hr-2g5m-vwhr), resolving the open dependabot security alerts. Dev-scope only — no runtime dependencies changed.

## [0.6.2] - 2026-08-24

### Fixed
- **AI Tools – Operations field for Transaction when write operations are disabled**: With 'Allow Write Operations' off, the node UI now shows the Operations field with 'Get All', mirroring the 0.5.2 fix for read-only resources. Previously no Operations field appeared for Transaction in that mode, although the node exposes `getAll` to MCP/agents. The 0.5.1 'hide the field' wording in the changelog is superseded by this entry.
- **AI Tools – explicit operation selection honored**: With write operations disabled, the stored Operations selection is now honored (including an empty selection, which triggers the standard 'No operations selected' validation). The implicit `getAll` fallback applies only to legacy workflows saved while the field was hidden.

## [0.6.1] - 2026-08-23

### Fixed
- **AI Tools – duplicate tool name collision**: Connecting more than one `Buxfer AI Tools` node to the same AI Agent failed with `You have multiple tools with the same name: 'buxfer_listAccounts'`. Every node exposed the discovery helpers under fixed names, so any two nodes collided — even with different resources.
- **AI Tools – resource-scoped tool names**: Discovery helper tools are now scoped by resource: `buxfer_listAccounts_{resource}` and `buxfer_listTags_{resource}` (main tool stays `buxfer_{resource}`, unchanged). Two nodes with different resources on the same agent no longer collide. Two nodes configured with the *same* resource still collide — n8n's own duplicate-tool-name error covers that case, which is an accepted limitation rather than something this node works around.
- **AI Tools – envelope + hints use the registered name**: The response envelope's `tool` field and all LLM-facing descriptions/error hints now reference the actual registered tool name (previously a stale `buxfer_{resource}` identifier for the helper tools, which never matched their registered names).

## [0.6.0] - 2026-08-23

### Changed
- **Buxfer node – native n8n HTTP client**: Replaced direct `axios` usage with n8n's built-in `helpers.httpRequest()` in `api.ts`. The node no longer needs an axios runtime dependency (this also resolves the "Cannot find module 'axios'" install failure), and requests now go through n8n's standard outbound HTTP stack (proxy settings, SSRF protection, default user agent). Token caching, 429 rate-limit handling, and error logging are preserved and extended to the login request. The 401 auto-retry is now functionally reachable for the first time (previously dead code under axios's default error handling). Error message text for failed requests has changed format (`HTTP <code> (body: ...)` instead of axios's generic message) — workflows pattern-matching on the old text should be updated.

## [0.5.3] - 2026-07-09

### Fixed
- **AI Tools – LangChain/zod runtime resolution**: AI Tools now resolves `DynamicStructuredTool` and `zod` from n8n's module tree on pnpm-strict-isolated installs (n8n ≥2.29.x), preserving `instanceof ZodType` identity for tool schema normalisation. `@langchain/core` moved to optional peer dependency (host-provided by n8n).

## [0.5.2] - 2026-04-06

### Fixed
- **AI Tools – Operations field for all resources**: Non-transaction resources (Account, Budget, Contact, Group, Loan, Reminder, Tag) now show an Operations field in the node UI, making it visible that `getAll` is the exposed operation. Previously no Operations field appeared for these resources.

## [0.5.1] - 2026-04-06

### Fixed
- **AI Tools – Allow Write Operations toggle**: Toggle now has visible effect in the UI. The Operations field is hidden when write operations are disabled (defaulting to getAll only) and shown with all operations when enabled. Previously, the toggle only filtered at runtime but had no visible UI impact.

## [0.5.0] - 2026-04-05

### Added
- **AI Tools node**: New `Buxfer AI Tools` node exposes all 8 resources (Account, Budget, Contact, Group, Loan, Reminder, Tag, Transaction) as AI Agent / MCP tools
- **Transaction CRUD via AI**: Full create, update, delete support with write-safety toggle
- **Discovery helpers**: `buxfer_listAccounts` and `buxfer_listTags` tools for LLM-driven value discovery
- **Structured envelopes**: All tool responses use versioned success/error envelopes for reliable LLM parsing
- **Dual-path dispatch**: Supports both Agent V3 (execute) and Agent V2/MCP (supplyData) paths

## [0.4.0] - 2026-02-08

### Fixed
- **Transaction Create/Update – tags**: Tags are now sent to the Buxfer API as comma-separated **tag names** instead of tag IDs. This prevents Buxfer from creating new tags with numeric "names" when updating or creating transactions with tags.

## [0.3.0] - 2026-02-08

### Changed
- **Transaction – optional inputs**: Filters and optional fields are now in collapsible sections so the UI stays minimal by default.
  - **Get Many**: All filters (date range, account, tag, status, keyword, amount, return all, limit) are in an optional **Filters** collection.
  - **Create**: Only required fields (description, amount, date, account ID, type, status) are shown; tags and type-specific fields (payers, sharers, loan, paid-for-friend) are in **Additional Fields**.
  - **Update**: Only **Transaction ID** is required; all editable fields are in **Fields to Update** for explicit partial updates.

### Fixed
- **API**: POST body now correctly JSON-stringifies array parameters (e.g. payers, sharers) when sending to the Buxfer API.
- **Transaction dates**: All date parameters (Get Many custom range, Create date, Update date) are now formatted as YYYY-MM-DD for the Buxfer API.

## [0.2.0] - 2026-02-08

### Fixed
- **Transaction Get Many**: Optional Amount filter no longer throws "Could not get parameter" when left empty. Amount filter and Amount comparison are read safely so the node runs without requiring these fields.

## [0.1.0] - 2025-10-27

### Added
- Initial release of n8n-nodes-buxfer
- **Transaction Management**:
  - Get transactions with filtering (date range, account, tag, status)
  - Client-side keyword search and amount filtering with pagination
  - Amount comparison options (equal, above, below) for precise filtering
  - Create transactions with support for all transaction types
  - Update existing transactions
  - Delete transactions
- **Account Management**:
  - Get all accounts
- **Tag Management**:
  - Get all tags
- **Budget Management**:
  - Get all budgets
- **Loan Management**:
  - Get all loans
- **Reminder Management**:
  - Get all reminders
- **Group Management**:
  - Get all groups
- **Contact Management**:
  - Get all contacts
- **Authentication**:
  - Email/password based authentication
  - Automatic token management and refresh
- **Error Handling**:
  - Comprehensive error handling with proper n8n error types
  - Rate limiting detection and handling
