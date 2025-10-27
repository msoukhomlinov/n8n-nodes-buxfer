import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { buxferApiRequest } from '../api.js';

export async function getAccounts(context: IExecuteFunctions | ILoadOptionsFunctions): Promise<any[]> {
  const response = await buxferApiRequest(context, 'GET', '/accounts');
  // Unwrap: extract accounts array
  return response?.response?.accounts || [];
}
