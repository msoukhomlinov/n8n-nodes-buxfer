# Child Entity Implementation Template

This document provides a streamlined template for implementing child entities in the Autotask integration, based on proven implementation patterns.

## Critical Naming Rules

IMPORTANT: The API endpoint name in Swagger/API docs is the source of truth for naming.

Template Pattern:
- Standalone API Endpoint: `/V1.0/[EntityNamePlural]` (e.g. `/V1.0/Phases`)
- Child API Endpoint: `/V1.0/[ParentNamePlural]/{parentId}/[EntityNamePlural]` (e.g. `/V1.0/Projects/{projectId}/Phases`)
- Entity Type: `'[EntityNamePlural]'` (in code, MUST match API endpoint exactly)
- Resource Value: `'[entityNameCamel]'` (in definitions)
- Display Name: '[ParentEntity] [EntityName]' (in UI)
- Operation Function: `execute[ParentEntity][EntityName]Operation`

Example (Project Phases):
- Standalone API Endpoint: `/V1.0/Phases`
- Child API Endpoint: `/V1.0/Projects/{projectId}/Phases`
- Entity Type: `'Phases'` (in code - MUST match API's 'Phases', not 'phase' or 'ProjectPhase')
- Resource Value: `'phase'` (in definitions)
- Display Name: 'Project Phase' (in UI)
- Operation Function: `executeProjectPhaseOperation`

CRITICAL Rules:
1. ALWAYS use the exact plural form from API endpoints (e.g. 'Phases', not 'phase')
2. NEVER convert API endpoint names to singular form
3. NEVER prefix entity types with parent name unless API does
4. Child endpoints MUST match parent endpoint pattern exactly
5. Resource values can be camelCase for n8n compatibility

This ensures consistency between API calls and internal references while maintaining user-friendly UI labels.

## Implementation Phases

### 1. Entity Definition Setup

1. Add child entity metadata in `constants/entities.ts`:
   ```typescript
   {
     // CRITICAL: Use exact API endpoint entity name
     name: '[EntityName]',  // Example: 'Phase', NOT 'ProjectPhase'
     childOf: '[ParentEntity]',  // Example: 'Project'
     // CRITICAL: Use exact subname from child API endpoint
     subname: '[ChildEndpointName]',  // Example: 'Phases' for /Projects/{id}/Phases, 'Charges' for /Tickets/{id}/Charges
     parentIdField: '[parentEntity]ID',  // Example: 'projectID'
     operations: {
       [OperationType.CREATE]: 'parent',
       [OperationType.UPDATE]: 'parent',
       [OperationType.QUERY]: 'self',
       [OperationType.COUNT]: 'self',
       // Include if entity supports deletion:
       [OperationType.DELETE]: 'parent'  // or 'self' based on API requirements
       // Note: getManyAdvanced is automatically available for all entities with QUERY support
     }
   }
   ```

2. Update required fields in `constants/field.constants.ts`:
   ```typescript
   export const REQUIRED_UPDATE_ID_FIELDS: Record<string, string[]> = {
     // CRITICAL: Use exact API endpoint entity name
     '[EntityName]': ['[parentEntity]ID'],  // Example: 'Phase': ['projectID']
   } as const;
   ```

### 2. Resource Structure Creation

1. Create directory structure:
   ```
   /resources/[parentEntity][entityName]s/  // Example: /resources/projectPhases/
   ├── description.ts    # UI field definitions
   ├── execute.ts       # Operation handlers
   └── index.ts         # Exports
   ```

2. Add resource definition in alphabetical order:
   ```typescript
   {
     name: '[ParentEntity] [EntityName]',  // Example: 'Project Phase'
     value: '[entityName]',                // Example: 'phase' - CRITICAL: Match API endpoint
     description: 'Manage Autotask [ParentEntity] [EntityName]s',
   }
   ```
   
   IMPORTANT: The new entity MUST be added in strict alphabetical order within the RESOURCE_DEFINITIONS array.
   - Compare the first word of the 'name' property with existing entries
   - Example: 'Holiday' comes before 'Holiday Set' alphabetically
   - Double-check surrounding entries to ensure proper ordering
   - Incorrect ordering will cause confusion and inconsistency in the UI

3. In execute.ts:
   ```typescript
   // CRITICAL: Use exact API endpoint name
   const ENTITY_TYPE = '[entityName]';  // Example: 'phase', NOT 'projectPhase'
   ```

### 3. Operation Implementation

1. Conditional Business Logic (OPTIONAL - only if entity has specific business rules):
   
   **NOTE**: Most entities do not require conditional logic. Only implement this if the entity has documented business rules that restrict operations based on entity state.
   
   ```typescript
   // Example: TicketCharges cannot be updated/deleted when isBilled = true
   // ONLY implement similar patterns if your entity has documented business rule restrictions
   case 'update': {
     console.log('Debug: Starting update operation');

     // OPTIONAL: Get current entity to check business rules (only if entity requires it)
     const entityId = this.getNodeParameter('id', i) as string;
     const getOp = new GetOperation<IAutotaskEntity>(ENTITY_TYPE, this, '[parentEntity]');
     const currentEntity = await getOp.execute(i);

     // OPTIONAL: Apply business rule validation (example: TicketCharge isBilled check)
     if (currentEntity.isBilled === true) {
       throw new NodeOperationError(
         this.getNode(),
         `Cannot update entity with ID ${entityId} because it has already been billed (isBilled = true). Only unbilled entities can be updated.`,
         { itemIndex: i }
       );
     }

     console.log('Debug: Entity validation passed, proceeding with update');
     const updateOp = new UpdateOperation<IAutotaskEntity>(ENTITY_TYPE, this);
     const response = await updateOp.execute(i, entityId);
     returnData.push({ json: response });
     break;
   }

   // For most entities, operations are straightforward without conditional logic:
   case 'update': {
     console.log('Debug: Starting update operation');
     const updateOp = new UpdateOperation<IAutotaskEntity>(ENTITY_TYPE, this);
     const entityId = this.getNodeParameter('id', i) as string;
     const response = await updateOp.execute(i, entityId);
     console.log('Debug: Update operation response:', response);
     returnData.push({ json: response });
     break;
   }
   ```

2. Base Operation Classes:
   ```typescript
   import {
     CreateOperation,
     UpdateOperation,
     GetOperation,
     GetManyOperation,
     CountOperation,
     DeleteOperation,  // Import if delete is supported
   } from '../../operations/base';
   import { handleGetManyAdvancedOperation } from '../../operations/common/get-many-advanced';

   const ENTITY_TYPE = '[parentEntity][entityName]';

   // These classes handle:
   // - Parent-child relationships
   // - URL construction
   // - Error handling
   // - Debug logging
   // - Delete operation (if supported)
   ```

3. Strategic Debug Logging:
   Use comprehensive logging for troubleshooting and monitoring:
   ```typescript
   case 'create': {
     console.log('Debug: Starting create operation');
     const createOp = new CreateOperation<IAutotaskEntity>(ENTITY_TYPE, this);
     console.log('Debug: Created operation instance');

     const response = await createOp.execute(i);
     console.log('Debug: Operation response:', response);
     returnData.push({ json: response });
     break;
   }

   case 'getMany': {
     console.log('Debug: Starting getMany operation');
     const getManyOp = new GetManyOperation<IAutotaskEntity>(ENTITY_TYPE, this, { parentType: '[parentEntity]' });
     const filters = await getManyOp.buildFiltersFromResourceMapper(i);
     const response = await getManyOp.execute({ filter: filters }, i);
     console.log('Debug: GetMany operation response count:', response.length);
     returnData.push(...getManyOp.processReturnData(response));
     break;
   }

   case 'count': {
     console.log('Debug: Starting count operation');
     const countOp = new CountOperation<IAutotaskEntity>(ENTITY_TYPE, this);
     const count = await countOp.execute(i);
     console.log('Debug: Count operation response:', count);
     returnData.push({
       json: {
         count,
         entityType: ENTITY_TYPE,
       },
     });
     break;
   }

   // getManyAdvanced operation (standard for all entities with QUERY support):
   case 'getManyAdvanced': {
     console.log('Debug: Starting getManyAdvanced operation');
     const results = await handleGetManyAdvancedOperation.call(this, ENTITY_TYPE, i, { parentType: '[parentEntity]' });
     console.log('Debug: GetManyAdvanced operation response count:', results.length);
     returnData.push(...results);
     break;
   }

   // If delete is supported:
   case 'delete': {
     console.log('Debug: Starting delete operation');
     const deleteOp = new DeleteOperation<IAutotaskEntity>(ENTITY_TYPE, this);
     console.log('Debug: Created DeleteOperation instance');

     const response = await deleteOp.execute(i);
     console.log('Debug: Delete operation response:', response);
     break;
   }
   ```

### 4. Picklist Support

Picklists (dropdown fields with predefined values) are automatically handled by the integration's infrastructure:

1. Basic Picklist Support:
   - The `resourceMapper` type automatically handles picklist fields
   - Fields with `isPickList: true` are automatically converted to dropdown options
   - No special code is needed for basic picklist support

2. Resource Mapper Configuration:
   - CRITICAL: Always use the standard `resourceMapperMethod: 'getFields'` in field definitions:
   ```typescript
   {
     displayName: 'Fields',
     name: 'fieldsToMap',
     type: 'resourceMapper',
     typeOptions: {
       resourceMapper: {
         resourceMapperMethod: 'getFields',  // CRITICAL: Always use 'getFields', NOT custom method names
         mode: 'add',
         // ... other options
       },
     },
     displayOptions: {
       show: {
         resource: ['[entityName]'],
         operation: ['create', 'update', 'getMany', 'count'],  // CRITICAL: Include 'count' for proper parameter handling
       },
     },
     // ... other properties
   }
   ```

3. Picklist Label Option:
   - Export baseFields directly from description.ts:
   ```typescript
   export const entityFields = baseFields;
   ```
   - The `addOperationsToResource` function will be applied centrally in Autotask.node.ts:
   ```typescript
   ...addOperationsToResource(entityFields, { resourceName: 'entityName' }),
   ```

3. Reference Field Display (if needed):
   - If your entity can be referenced by other entities, you may need to add an entry to `PICKLIST_REFERENCE_FIELD_MAPPINGS`:
   ```typescript
   // In constants/field.constants.ts
   export const PICKLIST_REFERENCE_FIELD_MAPPINGS: Record<string, IPicklistReferenceFieldMapping> = {
     // Existing mappings...
     '[EntityName]': {
       nameFields: ['name'], // Fields to display as the main label
       bracketField: ['id'], // Fields to show in brackets
       separator: ' ',       // Separator between nameFields
     },
   } as const;
   ```
   - This is only needed if your entity is referenced by other entities
   - Evaluate this need after basic implementation is complete

### 5. Main Node Integration

1. Update Autotask.node.ts:
   ```typescript
   // Add imports
   import { execute[ParentEntity][EntityName]Operation } from './resources/[parentEntity][entityName]s/execute';
   import { [parentEntity][entityName]Fields } from './resources/[parentEntity][entityName]s/description';

   // Add fields to properties
   properties: [
     ...existingFields,
     ...addOperationsToResource([parentEntity][entityName]Fields, { resourceName: '[entityName]' }),
   ],

   // Add execute case
   case '[parentEntity][entityName]':
     return execute[ParentEntity][EntityName]Operation.call(this);
   ```

2. Alphabetical Ordering:
   - CRITICAL: When adding the new resource to RESOURCE_DEFINITIONS, ensure strict alphabetical ordering
   - Compare the first word of the 'name' property with existing entries
   - Example: 'Holiday' must come before 'Holiday Set'
   - Incorrect ordering causes confusion and inconsistency in the UI
   - Always review the entire array to ensure proper ordering after adding a new entry

### 6. Testing & Verification

1. Operation Testing:
   - [ ] Create operation with parent context
   - [ ] Update operation with parent context
   - [ ] Get operation by ID
   - [ ] GetMany operation with filters
   - [ ] Count operation
   - [ ] Delete operation (if supported)

2. URL Pattern Verification:
   - [ ] Direct queries: `/V1.0/EntityName/query`
   - [ ] Parent-child: `/V1.0/Parents/{parentId}/EntityNames`
   - [ ] Count operations: `/V1.0/EntityName/query/count`
   - [ ] Delete operations: DELETE `/V1.0/Parents/{parentId}/EntityNames/{id}` (if supported)

3. Error Handling:
   - [ ] Parent ID validation
   - [ ] Operation-level try-catch
   - [ ] Proper error propagation

4. Picklist Verification:
   - [ ] Picklist fields display correctly in UI
   - [ ] Picklist values can be selected
   - [ ] Picklist labels option works if implemented

## Critical Points

1. API Endpoint Naming:
   - ALWAYS use the exact API endpoint name for:
     * Entity type in code (`ENTITY_TYPE`)
     * Resource value in definitions
     * Entity name in metadata
   - Use user-friendly names ONLY for:
     * Display names in UI
     * Directory structure
     * Code file organisation

2. Naming Conventions:
   - Use exact subname from child API endpoint structure
   - ALWAYS verify subname against actual API endpoint documentation
   - Example: If API uses `/V1.0/Projects/{projectId}/task`, use `subname: 'task'`
   - Example: If API uses `/V1.0/Projects/{projectId}/Phases`, use `subname: 'Phases'`
   - Example: If API uses `/V1.0/Tickets/{ticketId}/Charges`, use `subname: 'Charges'` (NOT 'TicketCharges')
   - Example: If API uses `/V1.0/Tickets/{ticketId}/ChecklistItems`, use `subname: 'ChecklistItems'` (NOT 'TicketChecklistItems')
   - CRITICAL: Maintain strict alphabetical order in RESOURCE_DEFINITIONS
     * Sort by the first word of the 'name' property (e.g., 'Holiday' before 'Holiday Set')
     * Always check surrounding entries when adding a new resource
     * Example: Resources should appear as 'Company', 'Contact', 'Holiday', 'Holiday Set', 'Product'
   - Use consistent casing for parent ID fields
   - Keep API endpoint names and internal references exactly matched

3. URL Patterns:
   - Query: GET `/V1.0/EntityName/query`  // Use exact API endpoint name
   - Count: GET `/V1.0/EntityName/query/count`
   - Create: POST `/V1.0/Parents/{parentId}/EntityNames`
   - Update: PATCH `/V1.0/Parents/{parentId}/EntityNames/{id}`
   - Delete: DELETE `/V1.0/Parents/{parentId}/EntityNames/{id}` (if supported)

4. Base Classes:
   - Use provided base operation classes
   - Let base classes handle URL construction
   - Leverage built-in error handling
   - Use built-in debug logging
   - Include DeleteOperation if entity supports deletion

5. Operation Support:
   - Check API documentation for supported operations
   - Verify if delete operation is available
   - Confirm delete operation context (parent vs self)
   - Test delete operation behaviour if supported
   - Always include getManyAdvanced for entities with QUERY support

6. Picklist Support:
   - Use resourceMapper type for fields to automatically handle picklists
   - Use addOperationsToResource function to add picklist label option
   - Consider adding PICKLIST_REFERENCE_FIELD_MAPPINGS entry if entity is referenced by others

## Implementation Progress Tracking

Use the scratchpad in `.cursorrules` to track progress:

```markdown
[ ] 1. Entity Definition Setup
    [ ] Add entity metadata
    [ ] Update required fields
    [ ] Configure parent relationship
    [ ] Check delete operation support

[ ] 2. Resource Structure Creation
    [ ] Create directory structure
    [ ] Create base files
    [ ] Add resource definition
    [ ] Add delete operation UI if supported

[ ] 3. Operation Implementation
    [ ] Implement operation handlers
    [ ] Add strategic logging
    [ ] Test parent context
    [ ] Implement delete operation if supported

[ ] 4. Picklist Support
    [ ] Use resourceMapper for fields
    [ ] Export baseFields directly from description.ts
    [ ] Ensure addOperationsToResource is applied in Autotask.node.ts
    [ ] Evaluate need for PICKLIST_REFERENCE_FIELD_MAPPINGS entry

[ ] 5. Main Node Integration
    [ ] Update imports
    [ ] Add fields
    [ ] Add execute case
    [ ] Add delete operation case if supported

[ ] 6. Testing & Verification
    [ ] Test operations
    [ ] Verify URLs
    [ ] Check error handling
    [ ] Test delete operation if supported
    [ ] Verify picklist functionality
```

## Best Practices

1. Base Class Usage:
   - Use base operation classes for standard functionality
   - Only add custom code when necessary
   - Leverage built-in parent context handling

2. Debug Logging:
   - Log operation start/end points
   - Log critical parameters
   - Log operation responses
   - Keep logging focused and meaningful

3. Error Handling:
   - Use operation-level try-catch
   - Let base classes handle specific errors
   - Add context to error messages

4. Parent Context:
   - Validate parent existence
   - Use consistent ID field naming
   - Follow proven URL patterns

5. Picklist Handling:
   - Let resourceMapper handle basic picklist fields
   - Export baseFields directly from description.ts
   - Ensure addOperationsToResource is applied in Autotask.node.ts for picklist label options
   - Only add PICKLIST_REFERENCE_FIELD_MAPPINGS entries when needed

## Common Pitfalls

1. API Endpoint Naming:
   - Using composite names (e.g., 'projectPhase') instead of exact API endpoint names ('phase')
   - Mixing internal reference names with API endpoint names
   - Inconsistent naming between entity definitions and resource values
   - Not checking API documentation for exact endpoint names

2. Subname Format:
   - Not matching the actual child API endpoint name
   - Using entity name instead of endpoint subname (e.g., 'TicketCharge' instead of 'Charges')
   - Not checking API documentation for exact child endpoint structure

3. Resource Definition:
   - Wrong alphabetical ordering
   - Inconsistent naming patterns
   - Missing or incorrect parent context
   - Missing delete operation support when available
   - Mismatch between API endpoint name and resource value

4. Operation Implementation:
   - Not using base classes
   - Overcomplicating error handling
   - Excessive custom code
   - Not checking for delete operation support
   - Incorrect delete operation context (parent vs self)
   - Forgetting to include getManyAdvanced operation
   - Using custom resourceMapperMethod names instead of 'getFields'
   - Missing 'count' in fieldsToMap displayOptions

5. Picklist Implementation:
   - Adding unnecessary custom code for picklist handling
   - Not using resourceMapper for fields
   - Not exporting baseFields directly from description.ts
   - Not applying addOperationsToResource in Autotask.node.ts
   - Adding PICKLIST_REFERENCE_FIELD_MAPPINGS entries unnecessarily

## Reference Implementation

See the ProjectNotes implementation for a complete example:
- `nodes/Autotask/resources/projectNotes/`
- Entity definition in `constants/entities.ts`
- Resource definition in `resources/definitions.ts`

Note: ProjectNotes does not support deletion, but other entities like Tasks do support it. Reference the Tasks implementation for delete operation patterns.

For picklist implementation examples, see the Contact entity which has picklist reference field mappings in `constants/field.constants.ts`.
