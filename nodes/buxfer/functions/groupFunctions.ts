import type { IExecuteFunctions } from 'n8n-workflow';
import { buxferApiRequest } from '../api.js';

export async function getGroups(context: IExecuteFunctions): Promise<any[]> {
  const response = await buxferApiRequest(context, 'GET', '/groups');
  // Unwrap: extract groups array
  return response?.response?.groups || [];
}
