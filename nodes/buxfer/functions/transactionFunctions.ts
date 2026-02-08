import type { IExecuteFunctions } from 'n8n-workflow';
import { buxferApiRequest } from '../api.js';
import { getTags } from './tagFunctions.js';

export function filterTransactionsByKeyword(transactions: any[], keyword: string): any[] {
  if (!keyword || keyword.trim() === '') {
    return transactions;
  }

  const searchTerm = keyword.toLowerCase().trim();

  return transactions.filter((transaction: any) => {
    const description = (transaction.description || '').toLowerCase();
    const extraInfo = (transaction.extraInfo || '').toLowerCase();

    return description.includes(searchTerm) || extraInfo.includes(searchTerm);
  });
}

export function filterTransactionsByAmount(
  transactions: any[],
  amount: number | undefined,
  comparison: string
): any[] {
  if (amount === undefined || amount === null) {
    return transactions;
  }

  return transactions.filter((transaction: any) => {
    const transactionAmount = transaction.amount;

    if (transactionAmount === undefined || transactionAmount === null) {
      return false;
    }

    switch (comparison) {
      case 'equal':
        return transactionAmount === amount;
      case 'above':
        return transactionAmount >= amount;
      case 'below':
        return transactionAmount <= amount;
      default:
        return true;
    }
  });
}

export function calculateDateRange(preset: string): { startDate: string; endDate: string } {
  const today = new Date();
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  switch (preset) {
    case 'today': {
      return { startDate: formatDate(today), endDate: formatDate(today) };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return { startDate: formatDate(yesterday), endDate: formatDate(yesterday) };
    }
    case 'thisWeek': {
      const startOfWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
      startOfWeek.setDate(diff);
      return { startDate: formatDate(startOfWeek), endDate: formatDate(today) };
    }
    case 'lastWeek': {
      const startOfLastWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1) - 7; // Monday of last week
      startOfLastWeek.setDate(diff);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6); // Sunday of last week
      return { startDate: formatDate(startOfLastWeek), endDate: formatDate(endOfLastWeek) };
    }
    case 'thisMonth': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: formatDate(startOfMonth), endDate: formatDate(today) };
    }
    case 'lastMonth': {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: formatDate(startOfLastMonth), endDate: formatDate(endOfLastMonth) };
    }
    case 'thisQuarter': {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const startOfQuarter = new Date(today.getFullYear(), currentQuarter * 3, 1);
      return { startDate: formatDate(startOfQuarter), endDate: formatDate(today) };
    }
    case 'lastQuarter': {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const year = lastQuarter === 3 ? today.getFullYear() - 1 : today.getFullYear();
      const startOfLastQuarter = new Date(year, lastQuarter * 3, 1);
      const endOfLastQuarter = new Date(year, lastQuarter * 3 + 3, 0);
      return { startDate: formatDate(startOfLastQuarter), endDate: formatDate(endOfLastQuarter) };
    }
    case 'thisYear': {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      return { startDate: formatDate(startOfYear), endDate: formatDate(today) };
    }
    case 'lastYear': {
      const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
      return { startDate: formatDate(startOfLastYear), endDate: formatDate(endOfLastYear) };
    }
    case 'last7Days': {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6); // Include today, so 7 days total
      return { startDate: formatDate(sevenDaysAgo), endDate: formatDate(today) };
    }
    case 'last30Days': {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 29); // Include today, so 30 days total
      return { startDate: formatDate(thirtyDaysAgo), endDate: formatDate(today) };
    }
    case 'last90Days': {
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(today.getDate() - 89); // Include today, so 90 days total
      return { startDate: formatDate(ninetyDaysAgo), endDate: formatDate(today) };
    }
    case 'last365Days': {
      const yearAgo = new Date(today);
      yearAgo.setDate(today.getDate() - 364); // Include today, so 365 days total
      return { startDate: formatDate(yearAgo), endDate: formatDate(today) };
    }
    case 'allTime': {
      return { startDate: '', endDate: '' }; // No date filtering
    }
    default: {
      return { startDate: '', endDate: '' }; // Fallback to no filtering
    }
  }
}

/** Resolve tag IDs to comma-separated names for Buxfer API (transaction_add/transaction_edit expect tag names). */
export async function resolveTagIdsToNames(
  context: IExecuteFunctions,
  tagIds: string[]
): Promise<string> {
  if (!tagIds.length) return '';
  const tags = await getTags(context);
  const idToName = Object.fromEntries(
    tags.map((t: { id: string | number; name?: string }) => [String(t.id), t.name ?? String(t.id)])
  );
  const names = tagIds.map((id) => idToName[String(id)]).filter(Boolean);
  return names.join(',');
}

export async function getTransactions(context: IExecuteFunctions, filters: any = {}): Promise<any[]> {
  const response = await buxferApiRequest(context, 'GET', '/transactions', filters);
  // Unwrap: extract transactions array
  return response?.response?.transactions || [];
}

export async function createTransaction(context: IExecuteFunctions, data: any): Promise<any> {
  const response = await buxferApiRequest(context, 'POST', '/transaction_add', data);
  // Unwrap: extract transaction object
  return response?.response || {};
}

export async function updateTransaction(context: IExecuteFunctions, data: any): Promise<any> {
  const response = await buxferApiRequest(context, 'POST', '/transaction_edit', data);
  // Unwrap: extract transaction object
  return response?.response || {};
}

export async function deleteTransaction(context: IExecuteFunctions, transactionId: string): Promise<any> {
  const response = await buxferApiRequest(context, 'POST', '/transaction_delete', { id: transactionId });
  // Unwrap: extract response object
  return response?.response || {};
}
