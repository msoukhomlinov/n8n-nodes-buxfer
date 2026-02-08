# Changelog

All notable changes to the n8n-nodes-buxfer project will be documented in this file.

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
