import type { INodeProperties } from 'n8n-workflow';

export const budgetFields: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['budget'],
      },
    },
    options: [
      {
        name: 'Get All',
        value: 'getAll',
        description: 'Retrieve all budgets',
      },
    ],
    default: 'getAll',
  },
];
