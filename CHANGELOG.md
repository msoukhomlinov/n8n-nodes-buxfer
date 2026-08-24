# Changelog

All notable changes to the n8n-nodes-buxfer project will be documented in this file.

## [0.6.2] - 2026-08-24

### Fixed
- **AI Tools – Operations field for Transaction when write operations are disabled**: With 'Allow Write Operations' off, the node UI now shows the Operations field with 'Get All', mirroring the 0.5.2 fix for read-only resources. Previously no Operations field appeared for Transaction in that mode, although the node exposes `getAll` to MCP/agents. The 0.5.1 'hide the field' wording in the changelog is superseded by this entry.

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
