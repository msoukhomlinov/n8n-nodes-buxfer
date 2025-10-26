# Resource Execute File Template

This template shows how to implement a resource execute file with all common operations.

```typescript
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { IAutotaskEntity } from '../../types';
import {
	CreateOperation,
	UpdateOperation,
	GetOperation,
	GetManyOperation,
	CountOperation,
} from '../../operations/base';
import { executeEntityInfoOperations } from '../../operations/common/entityInfo.execute';
import { handleGetManyAdvancedOperation } from '../../operations/common/get-many-advanced';

const ENTITY_TYPE = '[entity-type]'; // Replace with actual entity type in lowercase

export async function execute[EntityName]Operation(
	this: IExecuteFunctions,
): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];
	const operation = this.getNodeParameter('operation', 0) as string;

	for (let i = 0; i < items.length; i++) {
		try {
			switch (operation) {
				case 'create': {
					const createOp = new CreateOperation<IAutotaskEntity>(ENTITY_TYPE, this);
					const response = await createOp.execute(i);
					returnData.push({ json: response });
					break;
				}

				case 'update': {
					const entityId = this.getNodeParameter('id', i) as string;
					const updateOp = new UpdateOperation<IAutotaskEntity>(ENTITY_TYPE, this);
					const response = await updateOp.execute(i, entityId);
					returnData.push({ json: response });
					break;
				}

				case 'get': {
					const getOp = new GetOperation<IAutotaskEntity>(ENTITY_TYPE, this);
					const response = await getOp.execute(i);
					returnData.push({ json: response });
					break;
				}

				case 'getMany': {
					const getManyOp = new GetManyOperation<IAutotaskEntity>(ENTITY_TYPE, this);
					const filters = getManyOp.buildFiltersFromResourceMapper(i);
					const response = await getManyOp.execute({ filter: filters }, i);
					returnData.push(...getManyOp.processReturnData(response));
					break;
				}

				case 'getManyAdvanced': {
					const results = await handleGetManyAdvancedOperation.call(this, ENTITY_TYPE, i);
					returnData.push(...results);
					break;
				}

				case 'count': {
					const countOp = new CountOperation<IAutotaskEntity>(ENTITY_TYPE, this);
					const count = await countOp.execute(i);
					returnData.push({
						json: {
							count,
							entityType: ENTITY_TYPE,
						},
					});
					break;
				}

				case 'getEntityInfo':
				case 'getFieldInfo': {
					const response = await executeEntityInfoOperations(operation, ENTITY_TYPE, this, i);
					returnData.push(response);
					break;
				}

				default:
					throw new Error(`Operation ${operation} is not supported`);
			}
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ json: { error: error.message } });
				continue;
			}
			throw error;
		}
	}

	return [returnData];
}
```

## Usage Instructions

1. Replace `[entity-type]` with the lowercase entity type (e.g., 'company', 'ticket', etc.)
2. Replace `[EntityName]` with the PascalCase entity name (e.g., 'Company', 'Ticket', etc.)
3. Remove any operations that are not supported by the entity (check entity metadata)
4. For child entities, add parent type handling in the operation constructors
5. Add any entity-specific operations or handling as needed

## Supported Common Operations

- `create` - Create a new entity
- `update` - Update an existing entity
- `get` - Get a single entity by ID
- `getMany` - Get multiple entities using field filters
- `getManyAdvanced` - Get multiple entities using JSON filters
- `count` - Count entities matching field filters
- `getEntityInfo` - Get entity metadata
- `getFieldInfo` - Get field definitions

## Notes

- All common operations are handled by base operation classes
- Error handling is consistent across all operations
- Pagination is handled automatically by the base classes
- Parent-child relationships are handled by the base classes
- Resource mapper field handling is standardised
- Entity info operations are available to all entities
- Advanced query operations are available to all entities except searchFilter 