# Changelog

All notable changes to the n8n-nodes-buxfer project will be documented in this file.

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
