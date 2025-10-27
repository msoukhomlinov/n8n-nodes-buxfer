import type { INodeProperties } from 'n8n-workflow';

export const groupFields: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['group'],
      },
    },
    options: [
      {
        name: 'Get All',
        value: 'getAll',
        description: 'Retrieve all groups',
      },
    ],
    default: 'getAll',
  },
];
