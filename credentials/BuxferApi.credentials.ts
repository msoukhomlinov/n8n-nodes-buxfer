import type {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class BuxferApi implements ICredentialType {
  name = 'buxferApi';

  displayName = 'Buxfer API';

  documentationUrl = 'https://www.buxfer.com/help/api';

  properties: INodeProperties[] = [
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      default: '',
      required: true,
      description: 'Your Buxfer account email address',
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'Your Buxfer account password',
    },
  ];

  authenticate?: ICredentialType['authenticate'];
}
