import type {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getAccounts,
  getTags,
  getBudgets,
  getLoans,
  getReminders,
  getGroups,
  getContacts,
  calculateDateRange,
  filterTransactionsByKeyword,
  filterTransactionsByAmount,
  resolveTagIdsToNames,
} from './functions';

// Helper function to format dates to YYYY-MM-DD for Buxfer API
function formatDateForBuxfer(dateValue: string | undefined): string | undefined {
  if (!dateValue) return undefined;
  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
  // Parse ISO date and extract YYYY-MM-DD
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString().split('T')[0];
}

import { transactionFields } from './descriptions/transactionDescription';
import { accountFields } from './descriptions/accountDescription';
import { tagFields } from './descriptions/tagDescription';
import { budgetFields } from './descriptions/budgetDescription';
import { loanFields } from './descriptions/loanDescription';
import { reminderFields } from './descriptions/reminderDescription';
import { groupFields } from './descriptions/groupDescription';
import { contactFields } from './descriptions/contactDescription';
import { BuxferCache } from './cache';

export class Buxfer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Buxfer',
    name: 'buxfer',
    icon: { light: 'file:buxfer.svg', dark: 'file:buxfer.svg' },
    group: ['transform'],
    version: 1,
    description: 'Interact with Buxfer personal finance API',
    defaults: {
      name: 'Buxfer',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'buxferApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Account',
            value: 'account',
          },
          {
            name: 'Budget',
            value: 'budget',
          },
          {
            name: 'Contact',
            value: 'contact',
          },
          {
            name: 'Group',
            value: 'group',
          },
          {
            name: 'Loan',
            value: 'loan',
          },
          {
            name: 'Reminder',
            value: 'reminder',
          },
          {
            name: 'Tag',
            value: 'tag',
          },
          {
            name: 'Transaction',
            value: 'transaction',
          },
        ],
        default: 'transaction',
      },
      ...accountFields,
      ...budgetFields,
      ...contactFields,
      ...groupFields,
      ...loanFields,
      ...reminderFields,
      ...tagFields,
      ...transactionFields,
    ],
  };

  methods = {
    loadOptions: {
      async getAccountsList(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const cache = new BuxferCache(String(this.getNode().typeVersion ?? 1));

        // Try to get from cache first
        const cachedData = cache.get<{ id: string; name: string }>('accounts', this);
        if (cachedData) {
          const options = cachedData.map(account => ({
            name: account.name,
            value: account.id,
          }));
          return options.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }

        // Cache miss - fetch from API
        try {
          const accounts = await getAccounts(this);
          const options = accounts.map(account => ({
            name: account.name || account.id,
            value: account.id,
          }));

          // Cache the result
          cache.set('accounts', this, accounts);

          return options.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } catch (error) {
          throw new NodeOperationError(this.getNode(), `Failed to load accounts: ${(error as Error).message}`);
        }
      },

      async getAccountsFilterOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        // Build base list (with caching) and prepend an empty option to allow "no filter"
        const cache = new BuxferCache(String(this.getNode().typeVersion ?? 1));
        const cachedData = cache.get<{ id: string; name: string }>('accounts', this);
        let base: INodePropertyOptions[];
        if (cachedData) {
          base = cachedData.map(account => ({ name: account.name, value: account.id }));
        } else {
          const accounts = await getAccounts(this);
          base = accounts.map(account => ({ name: account.name || account.id, value: account.id }));
          cache.set('accounts', this, accounts);
        }
        // Sort the base list alphabetically
        base.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return [{ name: 'Any Account', value: '' }, ...base];
      },

      async getTagsList(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const cache = new BuxferCache(String(this.getNode().typeVersion ?? 1));

        // Try to get from cache first
        const cachedData = cache.get<{ id: string; name: string }>('tags', this);
        if (cachedData) {
          const options = cachedData.map(tag => ({
            name: tag.name || tag.id,
            value: tag.id,
          }));
          return options.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }

        // Cache miss - fetch from API
        try {
          const tags = await getTags(this);
          const options = tags.map(tag => ({
            name: tag.name || tag.id,
            value: tag.id,
          }));

          // Cache the result
          cache.set('tags', this, tags);

          return options.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } catch (error) {
          throw new NodeOperationError(this.getNode(), `Failed to load tags: ${(error as Error).message}`);
        }
      },

      async getTagsFilterOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        // Build base list (with caching) and prepend an empty option to allow "no filter"
        const cache = new BuxferCache(String(this.getNode().typeVersion ?? 1));
        const cachedData = cache.get<{ id: string; name: string }>('tags', this);
        let base: INodePropertyOptions[];
        if (cachedData) {
          base = cachedData.map(tag => ({ name: tag.name || tag.id, value: tag.id }));
        } else {
          const tags = await getTags(this);
          base = tags.map(tag => ({ name: tag.name || tag.id, value: tag.id }));
          cache.set('tags', this, tags);
        }
        // Sort the base list alphabetically
        base.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return [{ name: 'Any Tag', value: '' }, ...base];
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        let responseData: any;

        if (resource === 'transaction') {
          // Handle transaction operations
          switch (operation) {
            case 'getMany': {
              const filtersParam = (this.getNodeParameter('filters', i) as Record<string, unknown>) || {};
              const dateRange = (filtersParam.dateRange as string) ?? 'allTime';
              const accountId = filtersParam.accountId as string | undefined;
              const tagId = filtersParam.tagId as string | undefined;
              const status = (filtersParam.status as string[]) ?? [];
              const keyword = (filtersParam.keyword as string) ?? '';
              const rawAmount = filtersParam.amountFilter;
              const amountFilter: number | undefined =
                rawAmount === '' || rawAmount === undefined || rawAmount === null
                  ? undefined
                  : (rawAmount as number);
              const amountComparison = (filtersParam.amountComparison as string) ?? 'equal';
              const returnAll = (filtersParam.returnAll as boolean) ?? false;
              const limit = returnAll ? undefined : ((filtersParam.limit as number) ?? 100);

              const filters: any = {};
              if (dateRange === 'custom') {
                const startDate = formatDateForBuxfer(filtersParam.startDate as string | undefined);
                const endDate = formatDateForBuxfer(filtersParam.endDate as string | undefined);
                if (startDate) filters.startDate = startDate;
                if (endDate) filters.endDate = endDate;
              } else {
                const { startDate, endDate } = calculateDateRange(dateRange);
                if (startDate) filters.startDate = startDate;
                if (endDate) filters.endDate = endDate;
              }
              if (accountId) filters.accountId = accountId;
              if (tagId) filters.tagId = tagId;
              if (status && status.length > 0) filters.status = status.join(',');

              if (returnAll) {
                // Fetch all transactions across multiple pages
                const allTransactions: any[] = [];
                let currentPage = 1;
                let hasMore = true;

                while (hasMore) {
                  filters.page = currentPage;
                  const pageResults = await getTransactions(this, filters);
                  allTransactions.push(...pageResults);

                  // If we got less than 100 results, we've reached the last page
                  if (pageResults.length < 100) {
                    hasMore = false;
                  }
                  currentPage++;
                }

                // Apply keyword filter if specified
                if (keyword && keyword.trim()) {
                  responseData = filterTransactionsByKeyword(allTransactions, keyword);
                } else {
                  responseData = allTransactions;
                }

                // Apply amount filter if specified
                if (amountFilter !== undefined && amountFilter !== null) {
                  responseData = filterTransactionsByAmount(responseData, amountFilter, amountComparison);
                }
              } else {
                // Handle pagination with filtering (keyword and/or amount)
                if ((keyword && keyword.trim()) || (amountFilter !== undefined && amountFilter !== null)) {
                  // Fetch pages iteratively until we have enough matching records
                  const allTransactions: any[] = [];
                  const filteredTransactions: any[] = [];
                  let currentPage = 1;
                  let hasMore = true;

                  while (hasMore && filteredTransactions.length < (limit || 100)) {
                    filters.page = currentPage;
                    const pageResults = await getTransactions(this, filters);
                    allTransactions.push(...pageResults);

                    // Apply filters to the new page results
                    let newFilteredResults = pageResults;

                    // Apply keyword filter if specified
                    if (keyword && keyword.trim()) {
                      newFilteredResults = filterTransactionsByKeyword(newFilteredResults, keyword);
                    }

                    // Apply amount filter if specified
                    if (amountFilter !== undefined && amountFilter !== null) {
                      newFilteredResults = filterTransactionsByAmount(newFilteredResults, amountFilter, amountComparison);
                    }

                    filteredTransactions.push(...newFilteredResults);

                    // If we got less than 100 results, we've reached the last page
                    if (pageResults.length < 100) {
                      hasMore = false;
                    }
                    currentPage++;
                  }

                  // Apply limit to filtered results
                  if (limit !== undefined && limit < filteredTransactions.length) {
                    responseData = filteredTransactions.slice(0, limit);
                  } else {
                    responseData = filteredTransactions;
                  }
                } else {
                  // No filters - use original single page logic
                  filters.page = 1;
                  const results = await getTransactions(this, filters);

                  // Apply limit if specified and valid
                  if (limit !== undefined && limit < results.length) {
                    responseData = results.slice(0, limit);
                  } else {
                    responseData = results;
                  }
                }
              }
              break;
            }

            case 'create': {
              const data: any = {
                description: this.getNodeParameter('description', i) as string,
                amount: this.getNodeParameter('amount', i) as number,
                date: formatDateForBuxfer(this.getNodeParameter('date', i) as string) || '',
                accountId: this.getNodeParameter('accountId', i) as string,
                type: this.getNodeParameter('type', i) as string,
                status: this.getNodeParameter('status', i) as string,
              };

              const additionalFields = (this.getNodeParameter('additionalFields', i) as Record<string, unknown>) || {};
              const tagIds = additionalFields.tags as string[] | undefined;
              if (tagIds && tagIds.length > 0) {
                data.tags = await resolveTagIdsToNames(this, tagIds);
              }

              const transactionType = data.type;
              if (transactionType === 'sharedBill') {
                const payers = additionalFields.payers as { payer?: unknown[] } | undefined;
                const sharers = additionalFields.sharers as { sharer?: unknown[] } | undefined;
                const isEvenSplit = additionalFields.isEvenSplit as boolean | undefined;
                if (payers?.payer) data.payers = payers.payer;
                if (sharers?.sharer) data.sharers = sharers.sharer;
                if (isEvenSplit !== undefined) data.isEvenSplit = isEvenSplit;
              } else if (transactionType === 'loan') {
                const loanedBy = additionalFields.loanedBy as string | undefined;
                const borrowedBy = additionalFields.borrowedBy as string | undefined;
                if (loanedBy) data.loanedBy = loanedBy;
                if (borrowedBy) data.borrowedBy = borrowedBy;
              } else if (transactionType === 'paidForFriend') {
                const paidBy = additionalFields.paidBy as string | undefined;
                const paidFor = additionalFields.paidFor as string | undefined;
                if (paidBy) data.paidBy = paidBy;
                if (paidFor) data.paidFor = paidFor;
              }

              responseData = await createTransaction(this, data);
              break;
            }

            case 'update': {
              const transactionId = this.getNodeParameter('transactionId', i) as string;
              const fieldsToUpdate = (this.getNodeParameter('fieldsToUpdate', i) as Record<string, unknown>) || {};
              const data: any = { id: transactionId };

              if (fieldsToUpdate.description !== undefined) data.description = fieldsToUpdate.description;
              if (fieldsToUpdate.amount !== undefined) data.amount = fieldsToUpdate.amount;
              if (fieldsToUpdate.date !== undefined) {
                data.date = formatDateForBuxfer(fieldsToUpdate.date as string);
              }
              if (fieldsToUpdate.accountId !== undefined) data.accountId = fieldsToUpdate.accountId;
              if (fieldsToUpdate.type !== undefined) data.type = fieldsToUpdate.type;
              if (fieldsToUpdate.status !== undefined) data.status = fieldsToUpdate.status;

              const tagIds = fieldsToUpdate.tags as string[] | undefined;
              if (tagIds && tagIds.length > 0) {
                data.tags = await resolveTagIdsToNames(this, tagIds);
              }

              const transactionType = data.type;
              if (transactionType === 'sharedBill') {
                const payers = fieldsToUpdate.payers as { payer?: unknown[] } | undefined;
                const sharers = fieldsToUpdate.sharers as { sharer?: unknown[] } | undefined;
                const isEvenSplit = fieldsToUpdate.isEvenSplit as boolean | undefined;
                if (payers?.payer) data.payers = payers.payer;
                if (sharers?.sharer) data.sharers = sharers.sharer;
                if (isEvenSplit !== undefined) data.isEvenSplit = isEvenSplit;
              } else if (transactionType === 'loan') {
                const loanedBy = fieldsToUpdate.loanedBy as string | undefined;
                const borrowedBy = fieldsToUpdate.borrowedBy as string | undefined;
                if (loanedBy) data.loanedBy = loanedBy;
                if (borrowedBy) data.borrowedBy = borrowedBy;
              } else if (transactionType === 'paidForFriend') {
                const paidBy = fieldsToUpdate.paidBy as string | undefined;
                const paidFor = fieldsToUpdate.paidFor as string | undefined;
                if (paidBy) data.paidBy = paidBy;
                if (paidFor) data.paidFor = paidFor;
              }

              responseData = await updateTransaction(this, data);
              break;
            }

            case 'delete': {
              const transactionId = this.getNodeParameter('transactionId', i) as string;
              responseData = await deleteTransaction(this, transactionId);
              break;
            }

            default:
              throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
          }
        } else {
          // Handle read-only operations
          if (operation !== 'getAll') {
            throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
          }

          switch (resource) {
            case 'account':
              responseData = await getAccounts(this);
              break;
            case 'budget':
              responseData = await getBudgets(this);
              break;
            case 'contact':
              responseData = await getContacts(this);
              break;
            case 'group':
              responseData = await getGroups(this);
              break;
            case 'loan':
              responseData = await getLoans(this);
              break;
            case 'reminder':
              responseData = await getReminders(this);
              break;
            case 'tag':
              responseData = await getTags(this);
              break;
            default:
              throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`);
          }
        }

        if (Array.isArray(responseData)) {
          returnData.push(...responseData.map((item) => ({ json: item })));
        } else {
          returnData.push({ json: responseData });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
