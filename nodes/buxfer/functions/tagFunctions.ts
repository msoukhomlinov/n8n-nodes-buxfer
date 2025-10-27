import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { buxferApiRequest } from '../api.js';

export async function getTags(context: IExecuteFunctions | ILoadOptionsFunctions): Promise<any[]> {
  const response = await buxferApiRequest(context, 'GET', '/tags');
  // Unwrap: extract tags array
  return response?.response?.tags || [];
}
