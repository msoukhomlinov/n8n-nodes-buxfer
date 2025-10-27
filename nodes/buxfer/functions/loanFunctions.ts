import type { IExecuteFunctions } from 'n8n-workflow';
import { buxferApiRequest } from '../api.js';

export async function getLoans(context: IExecuteFunctions): Promise<any[]> {
  const response = await buxferApiRequest(context, 'GET', '/loans');
  // Unwrap: extract loans array
  return response?.response?.loans || [];
}
