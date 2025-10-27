import type { INodeProperties } from 'n8n-workflow';

export const contactFields: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['contact'],
      },
    },
    options: [
      {
        name: 'Get All',
        value: 'getAll',
        description: 'Retrieve all contacts',
      },
    ],
    default: 'getAll',
  },
];
