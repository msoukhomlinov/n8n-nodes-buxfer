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

  // Get Many: optional Filters collection
  {
    displayName: 'Filters',
    name: 'filters',
    type: 'collection',
    placeholder: 'Add filter',
    default: {},
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['getMany'],
      },
    },
    options: [
      {
        displayName: 'Date Range',
        name: 'dateRange',
        type: 'options',
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
        default: '',
        description: 'Filter transactions by account ID',
      },
      {
        displayName: 'Tag ID',
        name: 'tagId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getTagsFilterOptions',
        },
        default: '',
        description: 'Filter transactions by tag ID',
      },
      {
        displayName: 'Status',
        name: 'status',
        type: 'multiOptions',
        options: [
          { name: 'Cleared', value: 'cleared' },
          { name: 'Pending', value: 'pending' },
          { name: 'Reconciled', value: 'reconciled' },
        ],
        default: [],
        description: 'Filter transactions by status',
      },
      {
        displayName: 'Keyword',
        name: 'keyword',
        type: 'string',
        default: '',
        description: 'Search in description and extraInfo (case-insensitive)',
      },
      {
        displayName: 'Amount Filter',
        name: 'amountFilter',
        type: 'number',
        default: undefined,
        description: 'Filter by amount (positive income, negative expense)',
      },
      {
        displayName: 'Amount Comparison',
        name: 'amountComparison',
        type: 'options',
        displayOptions: {
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
        default: false,
        description: 'Fetch all pages automatically',
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
            returnAll: [false],
          },
        },
        default: 100,
        description: 'Maximum number of transactions to return (1-100)',
      },
    ],
  },

  // Create: required fields only
  {
    displayName: 'Description',
    name: 'description',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create'],
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
        operation: ['create'],
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
        operation: ['create'],
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
        operation: ['create'],
      },
    },
    default: '',
    required: true,
    description: 'Account where the transaction occurred',
  },
  {
    displayName: 'Type',
    name: 'type',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create'],
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
        operation: ['create'],
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

  // Create: optional Additional Fields collection
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add field',
    default: {},
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Tags',
        name: 'tags',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getTagsList',
        },
        default: [],
        description: 'Select one or more tags',
      },
      {
        displayName: 'Payers',
        name: 'payers',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        displayOptions: {
          show: {
            '/type': ['sharedBill'],
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
              },
              {
                displayName: 'Amount',
                name: 'amount',
                type: 'number',
                default: 0,
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
            '/type': ['sharedBill'],
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
              },
              {
                displayName: 'Amount',
                name: 'amount',
                type: 'number',
                default: 0,
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
            '/type': ['sharedBill'],
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
            '/type': ['loan'],
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
            '/type': ['loan'],
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
            '/type': ['paidForFriend'],
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
            '/type': ['paidForFriend'],
          },
        },
        default: '',
        description: 'Contact ID of the person for whom payment was made',
      },
    ],
  },

  // Update: required Transaction ID only
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

  // Update: optional Fields to Update collection
  {
    displayName: 'Fields to Update',
    name: 'fieldsToUpdate',
    type: 'collection',
    placeholder: 'Add field',
    default: {},
    displayOptions: {
      show: {
        resource: ['transaction'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        default: '',
      },
      {
        displayName: 'Amount',
        name: 'amount',
        type: 'number',
        default: 0,
      },
      {
        displayName: 'Date',
        name: 'date',
        type: 'dateTime',
        default: '',
      },
      {
        displayName: 'Account ID',
        name: 'accountId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getAccountsList',
        },
        default: '',
      },
      {
        displayName: 'Type',
        name: 'type',
        type: 'options',
        options: [
          { name: 'Expense', value: 'expense' },
          { name: 'Income', value: 'income' },
          { name: 'Transfer', value: 'transfer' },
          { name: 'Shared Bill', value: 'sharedBill' },
          { name: 'Loan', value: 'loan' },
          { name: 'Paid For Friend', value: 'paidForFriend' },
        ],
        default: 'expense',
      },
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        options: [
          { name: 'Cleared', value: 'cleared' },
          { name: 'Pending', value: 'pending' },
        ],
        default: 'cleared',
      },
      {
        displayName: 'Tags',
        name: 'tags',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getTagsList',
        },
        default: [],
      },
      {
        displayName: 'Payers',
        name: 'payers',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        displayOptions: {
          show: {
            type: ['sharedBill'],
          },
        },
        default: {},
        options: [
          {
            name: 'payer',
            displayName: 'Payer',
            values: [
              { displayName: 'Contact ID', name: 'contactId', type: 'string', default: '' },
              { displayName: 'Amount', name: 'amount', type: 'number', default: 0 },
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
            type: ['sharedBill'],
          },
        },
        default: {},
        options: [
          {
            name: 'sharer',
            displayName: 'Sharer',
            values: [
              { displayName: 'Contact ID', name: 'contactId', type: 'string', default: '' },
              { displayName: 'Amount', name: 'amount', type: 'number', default: 0 },
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
            type: ['sharedBill'],
          },
        },
        default: true,
      },
      {
        displayName: 'Loaned By',
        name: 'loanedBy',
        type: 'string',
        displayOptions: {
          show: {
            type: ['loan'],
          },
        },
        default: '',
      },
      {
        displayName: 'Borrowed By',
        name: 'borrowedBy',
        type: 'string',
        displayOptions: {
          show: {
            type: ['loan'],
          },
        },
        default: '',
      },
      {
        displayName: 'Paid By',
        name: 'paidBy',
        type: 'string',
        displayOptions: {
          show: {
            type: ['paidForFriend'],
          },
        },
        default: '',
      },
      {
        displayName: 'Paid For',
        name: 'paidFor',
        type: 'string',
        displayOptions: {
          show: {
            type: ['paidForFriend'],
          },
        },
        default: '',
      },
    ],
  },
];
