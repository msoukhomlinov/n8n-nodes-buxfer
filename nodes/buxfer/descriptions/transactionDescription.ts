import type { INodeProperties } from 'n8n-workflow';

export const transactionFields: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['transaction'],
      },
    },
    options: [
      {
        name: 'Get Many',
        value: 'getMany',
        description: 'Retrieve multiple transactions with optional filtering',
      },
      {
        name: 'Create',
        value: 'create',
        description: 'Create a new transaction',
      },
      {
        name: 'Update',
        value: 'update',
        description: 'Update an existing transaction',
      },
      {
        name: 'Delete',
        value: 'delete',
        description: 'Delete a transaction',
      },
    ],
    default: 'getMany',
  },

  // Get Many filters
  {
    displayName: 'Date Range',
    name: 'dateRange',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
      },
    },
    options: [
      { name: 'All Time', value: 'allTime' },
      { name: 'Today', value: 'today' },
      { name: 'Yesterday', value: 'yesterday' },
      { name: 'This Week', value: 'thisWeek' },
      { name: 'Last Week', value: 'lastWeek' },
      { name: 'This Month', value: 'thisMonth' },
      { name: 'Last Month', value: 'lastMonth' },
      { name: 'This Quarter', value: 'thisQuarter' },
      { name: 'Last Quarter', value: 'lastQuarter' },
      { name: 'This Year', value: 'thisYear' },
      { name: 'Last Year', value: 'lastYear' },
      { name: 'Last 7 Days', value: 'last7Days' },
      { name: 'Last 30 Days', value: 'last30Days' },
      { name: 'Last 90 Days', value: 'last90Days' },
      { name: 'Last 365 Days', value: 'last365Days' },
      { name: 'Custom', value: 'custom' },
    ],
    default: 'allTime',
    description: 'Select a preset date range or choose Custom for specific dates',
  },
  {
    displayName: 'Start Date',
    name: 'startDate',
    type: 'dateTime',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
        dateRange: ['custom'],
      },
    },
    default: '',
    description: 'Start date for filtering transactions (YYYY-MM-DD format)',
  },
  {
    displayName: 'End Date',
    name: 'endDate',
    type: 'dateTime',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
        dateRange: ['custom'],
      },
    },
    default: '',
    description: 'End date for filtering transactions (YYYY-MM-DD format)',
  },
  {
    displayName: 'Account ID',
    name: 'accountId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getAccountsFilterOptions',
    },
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
      },
    },
    default: '',
    description: 'Filter transactions by account ID. Choose from the list, or specify an ID using an expression.',
  },
  {
    displayName: 'Tag ID',
    name: 'tagId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getTagsFilterOptions',
    },
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
      },
    },
    default: '',
    description: 'Filter transactions by tag ID. Choose from the list, or specify an ID using an expression.',
  },
  {
    displayName: 'Status',
    name: 'status',
    type: 'multiOptions',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
      },
    },
    options: [
      { name: 'Cleared', value: 'cleared' },
      { name: 'Pending', value: 'pending' },
      { name: 'Reconciled', value: 'reconciled' },
    ],
    default: [],
    description: 'Filter transactions by status (select multiple to include all selected statuses)',
  },
  {
    displayName: 'Keyword',
    name: 'keyword',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
      },
    },
    default: '',
    description: 'Search for keyword in transaction description and extraInfo fields (case-insensitive)',
  },
  {
    displayName: 'Amount Filter',
    name: 'amountFilter',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
      },
    },
    default: undefined,
    description: 'Filter transactions by amount (positive for income, negative for expenses)',
  },
  {
    displayName: 'Amount Comparison',
    name: 'amountComparison',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
      },
      hide: {
        amountFilter: [undefined, ''],
      },
    },
    options: [
      { name: 'Equal', value: 'equal' },
      { name: 'Above', value: 'above' },
      { name: 'Below', value: 'below' },
    ],
    default: 'equal',
    description: 'How to compare the amount',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
      },
    },
    default: false,
    description: 'Fetch all transactions across multiple pages automatically',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    typeOptions: {
      minValue: 1,
      maxValue: 100,
    },
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
        returnAll: [false],
      },
    },
    default: 100,
    description: 'Maximum number of transactions to return (1-100)',
  },

  // Create/Update/Delete common fields
  {
    displayName: 'Description',
    name: 'description',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
      },
    },
    default: '',
    required: true,
    description: 'Transaction description',
  },
  {
    displayName: 'Amount',
    name: 'amount',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
      },
    },
    default: 0,
    required: true,
    description: 'Transaction amount (positive for income, negative for expenses)',
  },
  {
    displayName: 'Date',
    name: 'date',
    type: 'dateTime',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
      },
    },
    default: '',
    required: true,
    description: 'Transaction date (YYYY-MM-DD format)',
  },
  {
    displayName: 'Account ID',
    name: 'accountId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getAccountsList',
    },
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
      },
    },
    default: '',
    required: true,
    description: 'Account ID where the transaction occurred. Choose from the list, or specify an ID using an expression.',
  },
  {
    displayName: 'Type',
    name: 'type',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
      },
    },
    options: [
      { name: 'Expense', value: 'expense' },
      { name: 'Income', value: 'income' },
      { name: 'Transfer', value: 'transfer' },
      { name: 'Shared Bill', value: 'sharedBill' },
      { name: 'Loan', value: 'loan' },
      { name: 'Paid For Friend', value: 'paidForFriend' },
    ],
    default: 'expense',
    required: true,
    description: 'Transaction type',
  },
  {
    displayName: 'Status',
    name: 'status',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
      },
    },
    options: [
      { name: 'Cleared', value: 'cleared' },
      { name: 'Pending', value: 'pending' },
    ],
    default: 'cleared',
    required: true,
    description: 'Transaction status',
  },
  {
    displayName: 'Tags',
    name: 'tags',
    type: 'multiOptions',
    typeOptions: {
      loadOptionsMethod: 'getTagsList',
    },
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
      },
    },
    default: [],
    description: 'Select one or more tags',
  },

  // Transaction ID for update/delete
  {
    displayName: 'Transaction ID',
    name: 'transactionId',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['update', 'delete'],
      },
    },
    default: '',
    required: true,
    description: 'ID of the transaction to update or delete',
  },

  // Special transaction type fields
  {
    displayName: 'Payers',
    name: 'payers',
    type: 'fixedCollection',
    typeOptions: {
      multipleValues: true,
    },
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
        type: ['sharedBill'],
      },
    },
    default: {},
    description: 'Payers for shared bill transactions',
    options: [
      {
        name: 'payer',
        displayName: 'Payer',
        values: [
          {
            displayName: 'Contact ID',
            name: 'contactId',
            type: 'string',
            default: '',
            description: 'Contact ID of the payer',
          },
          {
            displayName: 'Amount',
            name: 'amount',
            type: 'number',
            default: 0,
            description: 'Amount paid by this person',
          },
        ],
      },
    ],
  },
  {
    displayName: 'Sharers',
    name: 'sharers',
    type: 'fixedCollection',
    typeOptions: {
      multipleValues: true,
    },
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
        type: ['sharedBill'],
      },
    },
    default: {},
    description: 'Sharers for shared bill transactions',
    options: [
      {
        name: 'sharer',
        displayName: 'Sharer',
        values: [
          {
            displayName: 'Contact ID',
            name: 'contactId',
            type: 'string',
            default: '',
            description: 'Contact ID of the sharer',
          },
          {
            displayName: 'Amount',
            name: 'amount',
            type: 'number',
            default: 0,
            description: 'Amount owed by this person',
          },
        ],
      },
    ],
  },
  {
    displayName: 'Is Even Split',
    name: 'isEvenSplit',
    type: 'boolean',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
        type: ['sharedBill'],
      },
    },
    default: true,
    description: 'Whether the bill is split evenly',
  },
  {
    displayName: 'Loaned By',
    name: 'loanedBy',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
        type: ['loan'],
      },
    },
    default: '',
    description: 'Contact ID of the person who loaned the money',
  },
  {
    displayName: 'Borrowed By',
    name: 'borrowedBy',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
        type: ['loan'],
      },
    },
    default: '',
    description: 'Contact ID of the person who borrowed the money',
  },
  {
    displayName: 'Paid By',
    name: 'paidBy',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
        type: ['paidForFriend'],
      },
    },
    default: '',
    description: 'Contact ID of the person who paid',
  },
  {
    displayName: 'Paid For',
    name: 'paidFor',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create', 'update'],
        type: ['paidForFriend'],
      },
    },
    default: '',
    description: 'Contact ID of the person for whom payment was made',
  },
];
