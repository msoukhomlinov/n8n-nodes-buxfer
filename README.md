# n8n-nodes-buxfer

n8n community node for integrating with the Buxfer personal finance API. This node provides comprehensive access to your Buxfer financial data, allowing you to manage transactions, accounts, budgets, and more directly from your n8n workflows.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![n8n Community Node](https://img.shields.io/badge/n8n-Community%20Node-green.svg)](https://n8n.io)

## Installation

Install this community node in your n8n instance:

```bash
n8n install n8n-nodes-buxfer
```

**Prerequisites:**
- n8n instance (self-hosted or n8n Cloud)
- Buxfer account with API access

## Credentials

To use this node, you'll need to configure Buxfer API credentials:

1. Go to your n8n credentials section
2. Add new "Buxfer API" credentials
3. Enter your Buxfer email and password
4. The node will automatically handle token management and refresh

## Features

### Transaction Management (Full CRUD)

**Get Many Transactions** with advanced filtering:
- **Date Range Filtering**: 15+ preset options (Today, This Week, This Month, etc.) plus custom date ranges
- **Account Filtering**: Filter by specific accounts or view all
- **Tag Filtering**: Filter by transaction tags
- **Status Filtering**: Filter by cleared, pending, or reconciled status
- **Keyword Search**: Client-side search through transaction descriptions and extra info
- **Amount Filtering**: Filter by exact amount or use comparison operators (equal, above, below)
- **Pagination**: Automatic pagination with configurable limits or fetch all results

**Create Transactions** with support for 6 transaction types:
- **Expense**: Regular expense transactions
- **Income**: Income transactions
- **Transfer**: Money transfers between accounts
- **Shared Bill**: Split bills with multiple payers and sharers
- **Loan**: Track money lent or borrowed
- **Paid For Friend**: Track payments made on behalf of others

**Update & Delete**: Modify existing transactions or remove them entirely

### Read-Only Resources

- **Account**: Get all accounts
- **Tag**: Get all tags
- **Budget**: Get all budgets
- **Loan**: Get all loans
- **Reminder**: Get all reminders
- **Group**: Get all groups
- **Contact**: Get all contacts

## Key Capabilities

- **Automatic Token Management**: Handles Buxfer API authentication and token refresh automatically
- **Client-Side Filtering**: Advanced keyword and amount filtering with proper pagination support
- **Complex Transaction Types**: Full support for shared bills, loans, and friend payments
- **Comprehensive Error Handling**: Proper n8n error types with rate limiting detection
- **Performance Optimisation**: Intelligent caching for improved response times
- **Flexible Date Ranges**: 15+ preset date ranges plus custom date selection

## Usage Examples

### Get Recent Transactions
1. Add the Buxfer node to your workflow
2. Select "Transaction" resource and "Get Many" operation
3. Choose "Last 30 Days" from date range
4. Set limit to 50 transactions
5. Execute to retrieve your recent financial activity

### Create a Shared Bill
1. Select "Transaction" resource and "Create" operation
2. Choose "Shared Bill" as transaction type
3. Fill in basic details (description, amount, date, account)
4. Add payers and sharers with their respective amounts
5. Configure even split if applicable

### Filter Transactions by Amount
1. Select "Transaction" resource and "Get Many" operation
2. Set amount filter to 100
3. Choose "Above" comparison to find transactions over $100
4. Apply additional filters as needed

## Repository

- **GitHub**: [https://github.com/msoukhomlinov/n8n-nodes-buxfer](https://github.com/msoukhomlinov/n8n-nodes-buxfer)
- **Issues**: [Report bugs or request features](https://github.com/msoukhomlinov/n8n-nodes-buxfer/issues)

## Support

If you find this project helpful and would like to support its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow.svg)](https://buymeacoffee.com/msoukhomlinov)

## License

This project is licensed under the [MIT License](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a complete list of changes and new features.
