import type { IExecuteFunctions } from 'n8n-workflow';
import { buxferApiRequest } from '../api.js';

export async function getBudgets(context: IExecuteFunctions): Promise<any[]> {
  const response = await buxferApiRequest(context, 'GET', '/budgets');
  // Unwrap: extract budgets array
  return response?.response?.budgets || [];
}
