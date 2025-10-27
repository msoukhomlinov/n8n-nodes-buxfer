import type { INodeProperties } from 'n8n-workflow';

export const accountFields: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['account'],
      },
    },
    options: [
      {
        name: 'Get All',
        value: 'getAll',
        description: 'Retrieve all accounts',
      },
    ],
    default: 'getAll',
  },
];
