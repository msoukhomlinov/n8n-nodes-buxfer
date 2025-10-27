import type { INodeProperties } from 'n8n-workflow';

export const tagFields: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['tag'],
      },
    },
    options: [
      {
        name: 'Get All',
        value: 'getAll',
        description: 'Retrieve all tags',
      },
    ],
    default: 'getAll',
  },
];
