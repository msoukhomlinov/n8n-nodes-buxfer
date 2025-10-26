# Entity Implementation Template

This document provides a comprehensive template for implementing new entities in the Autotask integration. Follow this structure to ensure consistent and complete entity implementations.

## Required Components

1. Entity Definition
   [ ] Add entity metadata in `nodes/Autotask/constants/entities.ts`:
       ```typescript
       {
         name: '[EntityName]',
         operations: {
           [OperationType.CREATE]: 'self',
           [OperationType.UPDATE]: 'self',
           [OperationType.QUERY]: 'self',
           [OperationType.DELETE]: 'self',
           [OperationType.COUNT]: 'self'
         }
       }
       ```
   [ ] Define child entities with proper parent relationships
   [ ] Set up attachment support if needed (isAttachment flag)
   [ ] Configure parent chain for nested relationships
   [ ] Use consistent casing for parent ID parameters (e.g., projectID, companyID)

2. Resource Structure
   [ ] Create resource directory structure in `nodes/Autotask/resources/`:
      ```
      /[entityName]/           # Use plural form for directory
      ├── description.ts        # UI field definitions
      ├── execute.ts           # Operation handlers
      └── index.ts            # Exports
      ```
   [ ] Add to resource definitions in `resources/definitions.ts`:
      ```typescript
      {
        name: '[Entity Name]',   // Use proper casing (e.g., 'Project Task')
        value: '[entityName]', // Use lowercase hyphenated (e.g., 'project-task')
        description: 'Manage Autotask [EntityName]s',
      }
      ```
   [ ] IMPORTANT: Ensure the new entity is added in alphabetical order within the RESOURCE_DEFINITIONS array
   [ ] Double-check alphabetical ordering by comparing with existing entries (e.g., 'Holiday' comes before 'Holiday Set')

3. Operations Support
   [ ] Create execute[EntityName]Operation function with structure:
      ```typescript
      const ENTITY_TYPE = '[entityName]';

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
              case 'delete': {
                const entityId = this.getNodeParameter('id', i) as string;
                const deleteOp = new DeleteOperation<IAutotaskEntity>(ENTITY_TYPE, this);
                const response = await deleteOp.execute(i, entityId);
                returnData.push({ json: response });
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
              case 'getManyAdvanced': {
                const response = await handleGetManyAdvancedOperation.call(this, ENTITY_TYPE, i);
                returnData.push(...response);
                break;
              }
              case 'getEntityInfo':
              case 'getFieldInfo': {
                const response = await executeEntityInfoOperations.call(this, ENTITY_TYPE, operation, i);
                returnData.push({ json: response });
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
   [ ] Import required functions at the top of execute.ts:
      ```typescript
      import {
        CreateOperation,
        UpdateOperation,
        GetOperation,
        GetManyOperation,
        DeleteOperation,
        CountOperation
      } from '../../base/operations';
      import {
        executeEntityInfoOperations,
        handleGetManyAdvancedOperation
      } from '../../common/operations';
      ```

4. UI Components
   [ ] Define field descriptions in description.ts:
      ```typescript
      import { getManyAdvancedOptions } from '../../common/operations';
      import { addOperationsToResource } from '../../common/helpers';

      export const operationOptions = [
        {
          name: 'Create',
          value: 'create',
          description: 'Create a [entity-name]',
          action: 'Create a [entity-name]',
        },
        {
          name: 'Update',
          value: 'update',
          description: 'Update a [entity-name]',
          action: 'Update a [entity-name]',
        },
        {
          name: 'Get',
          value: 'get',
          description: 'Get a [entity-name]',
          action: 'Get a [entity-name]',
        },
        {
          name: 'Get Many',
          value: 'getMany',
          description: 'Get many [entity-name]s',
          action: 'Get many [entity-name]s',
        },
        {
          name: 'Delete',
          value: 'delete',
          description: 'Delete a [entity-name]',
          action: 'Delete a [entity-name]',
        },
        {
          name: 'Count',
          value: 'count',
          description: 'Count [entity-name]s',
          action: 'Count [entity-name]s',
        },
      ];

      export const baseFields: INodeProperties[] = [
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          noDataExpression: true,
          displayOptions: {
            show: {
              resource: ['[entity-name]'],
            },
          },
          options: operationOptions,
          default: 'create',
        },
        {
          displayName: '[EntityName] ID',
          name: 'id',
          type: 'string',
          required: true,
          default: '',
          displayOptions: {
            show: {
              resource: ['[entity-name]'],
              operation: ['update', 'get', 'delete'],
            },
          },
          description: 'The ID of the [entity-name] to operate on',
        },
        {
          displayName: 'Fields',
          name: 'fieldsToMap',
          type: 'resourceMapper',
          default: {
            mappingMode: 'defineBelow',
            value: null,
          },
          required: true,
          displayOptions: {
            show: {
              resource: ['[entity-name]'],
              operation: ['create', 'update', 'getMany', 'count'],
            },
          },
          typeOptions: {
            loadOptionsDependsOn: ['resource', 'operation'],
            resourceMapper: {
              resourceMapperMethod: 'getFields',
              mode: 'add',
              fieldWords: {
                singular: 'field',
                plural: 'fields',
              },
              addAllFields: false,
              multiKeyMatch: true,
              supportAutoMap: true,
            },
          },
        },
      ];

      // Export baseFields directly - addOperationsToResource will be applied in Autotask.node.ts
      export const [entityName]Fields = baseFields;
      ```

5. Integration
   [ ] Update Autotask.node.ts:
      ```typescript
      // Add imports
      import { execute[EntityName]Operation } from './resources/[entity-name]/execute';
      import { [entityName]Fields } from './resources/[entity-name]/description';

      // Add to properties array
      properties: [
        // ... existing properties
        ...addOperationsToResource([entityName]Fields, { resourceName: '[entity-name]' }),
      ],

      // Add to resource switch statement
      switch (resource) {
        case '[entity-name]':
          return execute[EntityName]Operation.call(this);
        // ... other cases
      }
      ```
   [ ] Create index.ts file for exports:
      ```typescript
      export * from './description';
      export * from './execute';
      ```
   [ ] Update type definitions if needed
   [ ] Set up proper field mapping

## Naming Conventions

1. Entity Names
   - Use singular form in entity definitions (e.g., 'Project', not 'Projects')
   - Use plural form for directory names (e.g., 'projects', not 'project')
   - Use proper casing in resource definitions display name (e.g., 'Project Task')
   - Use lowercase in resource values (e.g., 'projectTask')
   - For ENTITY_TYPE constants, use camelCase (e.g., 'projectTask', not 'project-task')
   - The ENTITY_TYPE should match the resource value in definitions.ts, NOT the directory name

2. Parent-Child Relationships
   - Use consistent casing for parent ID fields (e.g., projectID, companyID)
   - Follow pattern /Parents/{parentId}/SubnameS/{id} for endpoints
   - Use proper parent chain arrays for nested relationships

3. File Structure
   - Place resources under nodes/Autotask/resources/
   - Use consistent file names (description.ts, execute.ts, index.ts)
   - Follow existing import/export patterns

## Best Practices

1. Code Organization
   - Keep entity type constant at top of execute.ts
   - Use base operation classes for all operations
   - Follow existing error handling patterns
   - Maintain consistent file structure
   - Import executeEntityInfoOperations and handleGetManyAdvancedOperation from common/operations
   - Use addOperationsToResource helper to add advanced operations

2. Error Handling
   - Use continueOnFail() pattern consistently
   - Include proper error context
   - Follow base operation error patterns
   - Use centralized error templates

3. Field Management
   - Use resourceMapper consistently for all field operations
   - Validate fields based on API capabilities (IsQueryable, IsReadOnly)
   - Process fields through central field processing pipeline
   - Handle UDF fields consistently across operations
   - Follow established field naming conventions
   - Export baseFields directly from description.ts
   - Apply addOperationsToResource centrally in Autotask.node.ts to add advanced operations

4. Operation Support
   - Implement all supported operations (including DELETE)
   - Use proper operation types
   - Support pagination in getMany
   - Handle API rate limiting
   - Support getManyAdvanced, getEntityInfo, and getFieldInfo operations

## Implementation Checklist

[ ] Entity Definition
  - [ ] Add entity metadata
  - [ ] Configure operations (including DELETE)
  - [ ] Set up parent relationships
  - [ ] Configure attachments if needed

[ ] Resource Structure
  - [ ] Create directory structure
  - [ ] Add resource definition
  - [ ] Create base files

[ ] Operations
  - [ ] Implement create
  - [ ] Implement update
  - [ ] Implement get
  - [ ] Implement getMany
  - [ ] Implement delete
  - [ ] Implement count
  - [ ] Implement getManyAdvanced
  - [ ] Implement getEntityInfo and getFieldInfo
  - [ ] Add error handling

[ ] UI Components
  - [ ] Define operations (including DELETE)
  - [ ] Add ID field with proper displayOptions for delete operation
  - [ ] Configure resource mapper
  - [ ] Set up field validation
  - [ ] Use addOperationsToResource helper

[ ] Integration
  - [ ] Update node imports
  - [ ] Add to properties
  - [ ] Update switch statement
  - [ ] Test all operations

## Testing Guidelines

1. Basic Operations
   - [ ] Test create with required fields
   - [ ] Test update with ID
   - [ ] Test get with ID
   - [ ] Test getMany with filters
   - [ ] Test count operation

2. Error Handling
   - [ ] Test invalid ID handling
   - [ ] Test missing required fields
   - [ ] Test API error responses
   - [ ] Test continueOnFail behavior

3. Field Validation
   - [ ] Test required fields
   - [ ] Test field type validation
   - [ ] Test field length limits
   - [ ] Test invalid values

4. Parent-Child Operations
   - [ ] Test parent ID validation
   - [ ] Test child creation
   - [ ] Test child updates
   - [ ] Test relationship integrity

## Error Handling and Field Validation

1. Error Handling Layers
   [ ] Implement error handling at multiple levels:
      ```typescript
      // Operation level error handling
      return await handleErrors(
        this.context,
        async () => {
          // Operation logic
        },
        {
          operation: 'operation_name',
          entityType: this.entityType,
        },
      );

      // Field validation error handling
      if (!field.isValid) {
        throw new Error(
          ERROR_TEMPLATES.validation
            .replace('{type}', 'ValidationError')
            .replace('{entity}', this.entityType)
            .replace('{details}', `Invalid field: ${field.name}`)
        );
      }

      // API response error handling
      if (!response.item) {
        throw new Error(
          ERROR_TEMPLATES.operation
            .replace('{type}', 'ResponseError')
            .replace('{operation}', operation)
            .replace('{entity}', this.entityType)
            .replace('{details}', 'Invalid API response')
        );
      }
      ```
2. Field Validation
   [ ] Implement FieldValidator for the entity:
      ```typescript
      class FieldValidator {
        validateFields(fields: IAutotaskField[], data: IDataObject): boolean {
          try {
            for (const field of fields) {
              const value = data[field.name];
              const fieldWithValidation = {
                ...field,
                validation: {
                  isRequired: field.isRequired,
                  isReadOnly: field.isReadOnly,
                  isQueryable: field.isQueryable,
                  length: field.length,
                },
              };

              if (!this.validateField(fieldWithValidation, value)) {
                return false;
              }
            }
            return true;
          } catch (error) {
            throw new Error(`Field validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
      ```

3. Field Processing Pipeline
   [ ] Implement field processing pipeline:
      ```typescript
      public async processFields(
        fields: IEntityField[] | IAutotaskField[] | IUdfFieldDefinition[],
        operation: ResourceOperation,
        options: IProcessFieldsOptions = {},
      ): Promise<IProcessedFields> {
        try {
          // 1. Normalize fields
          const normalizedFields = await this.normalizeFields(fields);

          // 2. Filter fields based on operation
          const filteredFields = this.filterFieldsByOperation(normalizedFields, operation);

          // 3. Convert fields using pipeline
          const convertedFields = await Promise.all(
            filteredFields.map(field =>
              this.pipeline.convertField(field, options.mode || 'write', operation)
            )
          );

          // 4. Process results
          const result: IProcessedFields = {
            fields: convertedFields.filter((field): field is ResourceMapperField => field !== null),
          };

          // 5. Additional processing based on options
          if (options.convertToProperties) {
            result.properties = this.convertFieldsToProperties(result.fields);
          }

          if (options.includeOptions) {
            result.options = this.generateFieldOptions(result.fields);
          }

          return result;
        } catch (error) {
          throw new Error(
            ERROR_TEMPLATES.operation
              .replace('{type}', 'ProcessingError')
              .replace('{operation}', 'processFields')
              .replace('{entity}', this.entityType)
              .replace('{details}', error instanceof Error ? error.message : 'Unknown error'),
          );
        }
      }
      ```

4. Operation Type Validation
   [ ] Implement operation type validation:
      ```typescript
      class OperationTypeValidator {
        async validateOperation(operation: string): Promise<boolean> {
          if (!this.isSupportedOperation(operation)) {
            throw new Error(`Unsupported operation: ${operation}`);
          }
          return true;
        }

        private isSupportedOperation(operation: string): operation is OperationType {
          return Object.values(OperationType).includes(operation as OperationType);
        }

        isWriteOperation(operation: string): boolean {
          return WRITE_OPERATIONS.includes(operation as WriteOperation);
        }
      }
      ```

5. Parent-Child Relationship Validation
   [ ] Implement parent ID validation:
      ```typescript
      // In create/update operations
      if (metadata?.childOf) {
        const parentIdField = `${metadata.childOf}ID`;
        const parentId = validatedData[parentIdField];

        if (!parentId) {
          throw new Error(
            ERROR_TEMPLATES.validation
              .replace('{type}', 'ValidationError')
              .replace('{entity}', this.entityType)
              .replace('{details}', `${metadata.childOf} ID (${parentIdField}) is required`)
          );
        }
      }
      ```

6. Response Processing
   [ ] Implement response validation and processing:
      ```typescript
      // Process API response
      if (!response.item) {
        throw new Error(
          ERROR_TEMPLATES.operation
            .replace('{type}', 'ResponseError')
            .replace('{operation}', operation)
            .replace('{entity}', this.entityType)
            .replace('{details}', 'Invalid API response: missing item data')
        );
      }

      // Process dates in response
      return processResponseDates.call(
        this.context,
        response.item,
        `${this.entityType}.${operation}`,
      ) as unknown as T;
      ```

## Special Considerations

1. User Defined Fields (UDF) Support
   [ ] Implement UDF support if entity requires it:
      ```typescript
      // Entity metadata
      hasUserDefinedFields: boolean;

      // Field type
      interface IEntityField extends IAutotaskField {
        isUdf?: boolean;
        udfType?: number;
        displayFormat?: number;
        isEncrypted?: boolean;
      }

      // UDF field processing
      if (field.isUdf) {
        return this.convertUdfValue(field, value);
      }
      ```

2. Attachment Support
   [ ] Configure attachment handling if needed:
      ```typescript
      // In entity metadata
      {
        name: '[EntityName]Attachment',
        childOf: '[EntityName]',
        subname: 'Attachment',
        isAttachment: true,
        operations: {
          [OperationType.CREATE]: 'parent',
          [OperationType.DELETE]: 'parent'
        }
      }

      // Attachment operations
      protected async uploadAttachment(
        itemIndex: number,
        data: IBinaryData,
        options: {
          title: string;
          parentId?: string | number;
          parentType?: string;
          publish?: boolean;
        },
      ): Promise<IAutotaskEntity>
      ```

3. Webhook Support
   [ ] Implement webhook support if entity requires it:
      ```typescript
      // In entity metadata
      supportsWebhookCallouts: boolean;

      // Webhook entity configuration
      {
        name: '[EntityName]Webhook',
        childOf: '[EntityName]',
        subname: 'Webhook',
        operations: {
          [OperationType.CREATE]: 'parent',
          [OperationType.UPDATE]: 'parent',
          [OperationType.DELETE]: 'parent'
        }
      }

      // Webhook field configuration
      {
        name: '[EntityName]WebhookField',
        childOf: '[EntityName]Webhook',
        subname: 'Field',
        parentChain: ['[EntityName]', '[EntityName]Webhook'],
        operations: {
          [OperationType.CREATE]: 'parent',
          [OperationType.DELETE]: 'parent'
        }
      }
      ```

4. Reference Field Support
   [ ] Configure reference field handling:
      ```typescript
      // In field definition
      interface IEntityField extends IAutotaskField {
        isReference: boolean;
        referenceEntityType?: ReferenceEnabledEntity | string;
      }

      // Reference field processing
      if (field.isReference) {
        return await this.resolveReference(field, value);
      }
      ```

5. Picklist Support
   [ ] Implement picklist support:
      ```typescript
      // In field definition
      interface IEntityField extends IAutotaskField {
        isPickList: boolean;
        picklistValues?: IPicklistField['picklistValues'];
        picklistParentValueField?: string;
      }

      // Picklist field processing
      if (field.isPickList) {
        return this.convertPicklistValue(field, value);
      }

      // Dependent picklist handling
      if (
        field.isPickList &&
        field.picklistParentValueField &&
        values[field.picklistParentValueField]
      ) {
        return await this.convertDependentPicklist(
          field,
          value,
          values[field.picklistParentValueField]
        );
      }
      ```

6. Entity Information Support
   [ ] Implement entity information endpoints:
      ```typescript
      // Entity information interface
      interface IEntityInfo {
        name: string;
        label: string;
        fields: IAutotaskField[];
        canCreate: boolean;
        canUpdate: boolean;
        canDelete: boolean;
        canQuery: boolean;
        hasUserDefinedFields: boolean;
        supportsWebhookCallouts: boolean;
        userAccessForCreate: 'None' | 'All' | 'Restricted';
        userAccessForDelete: 'None' | 'All' | 'Restricted';
        userAccessForQuery: 'None' | 'All' | 'Restricted';
        userAccessForUpdate: 'None' | 'All' | 'Restricted';
      }

      // Entity information endpoints
      GET /[EntityName]/entityInformation
      GET /[EntityName]/entityInformation/fields
      GET /[EntityName]/entityInformation/userDefinedFields
      ```

## Progress Tracking
[ ] Entity Definition
[ ] Resource Structure
[ ] Operations Implementation
[ ] UI Components
[ ] Integration
[ ] Error Handling Implementation
[ ] Field Validation Implementation
[ ] Pagination Implementation
[ ] Response Processing Implementation
[ ] UDF Support Implementation
[ ] Attachment Support Implementation
[ ] Webhook Support Implementation
[ ] Reference Field Support Implementation
[ ] Picklist Support Implementation
[ ] Entity Information Implementation

## Best Practices
- Follow existing patterns from Company entity implementation
- Ensure proper error handling and field validation
- Maintain consistent naming conventions
- Document any special considerations or requirements
- Use TypeScript types for better type safety
- Follow n8n-workflow interfaces for node properties
- Implement proper error handling with continueOnFail support
- Use resource mapper for field management
- Support pagination for getMany operations
- Handle API-specific error responses
- Implement comprehensive field validation
- Use error templates for consistent error messages
- Handle parent-child relationships properly
- Validate operation types
- Process API responses consistently
- Implement proper pagination with configurable page size
- Handle response processing with proper error handling
- Support parent-child query relationships
- Use pagination constants for consistency
- Implement proper response data mapping
- Support UDFs if entity requires them
- Implement attachment handling if needed
- Support webhooks if entity requires them
- Handle reference fields properly
- Support picklists and dependent picklists
- Implement entity information endpoints
- Follow Autotask security model
- Handle API zones properly
- Support field length validation
- Implement proper error status code handling

## Implementation Principles

1. Code Reuse and Centralization
   - ALWAYS reuse base operation classes (CreateOperation, UpdateOperation, DeleteOperation, etc.)
   - Follow existing entity patterns (use Company as reference)
   - Reuse central utility functions over creating new ones
   - Centralize common logic in base classes
   - Keep consistent file structure (description.ts, execute.ts, index.ts)
   - Export baseFields directly from description.ts
   - Apply addOperationsToResource centrally in Autotask.node.ts to add advanced operations

2. Operation Implementation
   - Only implement operations explicitly supported by the API
   - Use operation types from base/entity-types consistently
   - Maintain pagination support in getMany operations
   - Handle rate limiting through base classes
   - Implement error handling using base operation patterns
   - Support DELETE operation when applicable
   - Implement getManyAdvanced, getEntityInfo, and getFieldInfo operations

3. Field Management
   - Use resourceMapper consistently for all field operations
   - Validate fields based on API capabilities (IsQueryable, IsReadOnly)
   - Process fields through central field processing pipeline
   - Handle UDF fields consistently across operations
   - Follow established field naming conventions
   - Export baseFields directly from description.ts
   - Apply addOperationsToResource centrally in Autotask.node.ts to add advanced operations

4. Error Handling
   - Use centralized error templates
   - Include proper error context in all operations
   - Handle pagination errors consistently
   - Implement rate limiting error handling
   - Follow base operation error patterns

## Advanced Operations

1. getManyAdvanced Operation
   [ ] Import handleGetManyAdvancedOperation from common/operations
   [ ] Add case for getManyAdvanced in execute.ts switch statement
   [ ] Ensure addOperationsToResource is applied in Autotask.node.ts to add getManyAdvanced operation to UI

2. Entity Information Operations
   [ ] Import executeEntityInfoOperations from common/operations
   [ ] Add cases for getEntityInfo and getFieldInfo in execute.ts switch statement
   [ ] Ensure addOperationsToResource is applied in Autotask.node.ts to add entity information operations to UI

3. Delete Operation
   [ ] Add DELETE to entity operations in entities.ts
   [ ] Add delete option to operationOptions array in description.ts
   [ ] Add 'delete' to ID field's displayOptions.show.operation array
   [ ] Implement delete case in execute.ts switch statement
   [ ] Import DeleteOperation from base/operations

4. Using addOperationsToResource Helper
   [ ] Export baseFields directly from description.ts
   [ ] In Autotask.node.ts, import addOperationsToResource from helpers/resource-operations.helper
   [ ] Apply addOperationsToResource to the fields in Autotask.node.ts properties array
   [ ] Understand that this helper automatically adds:
      - getManyAdvanced operation
      - getEntityInfo operation
      - getFieldInfo operation
   [ ] Do NOT manually add these operations to operationOptions
