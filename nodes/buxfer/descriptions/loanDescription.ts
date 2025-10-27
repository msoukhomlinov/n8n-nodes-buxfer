import type { INodeProperties } from 'n8n-workflow';

export const loanFields: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['loan'],
      },
    },
    options: [
      {
        name: 'Get All',
        value: 'getAll',
        description: 'Retrieve all loans',
      },
    ],
    default: 'getAll',
  },
];
