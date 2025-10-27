import type { IExecuteFunctions } from 'n8n-workflow';
import { buxferApiRequest } from '../api.js';

export async function getReminders(context: IExecuteFunctions): Promise<any[]> {
  const response = await buxferApiRequest(context, 'GET', '/reminders');
  // Unwrap: extract reminders array
  return response?.response?.reminders || [];
}
