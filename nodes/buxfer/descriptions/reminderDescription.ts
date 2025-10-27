import type { INodeProperties } from 'n8n-workflow';

export const reminderFields: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['reminder'],
      },
    },
    options: [
      {
        name: 'Get All',
        value: 'getAll',
        description: 'Retrieve all reminders',
      },
    ],
    default: 'getAll',
  },
];
