import type { IExecuteFunctions } from 'n8n-workflow';
import { buxferApiRequest } from '../api.js';

export async function getContacts(context: IExecuteFunctions): Promise<any[]> {
  const response = await buxferApiRequest(context, 'GET', '/contacts');
  // Unwrap: extract contacts array
  return response?.response?.contacts || [];
}
