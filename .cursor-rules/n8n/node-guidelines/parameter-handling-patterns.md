# Parameter Handling Patterns in Autotask Integration

## Overview
This document outlines the parameter handling patterns used in the Autotask integration, focusing on consistent and reliable parameter processing across all operations.

## Core Concepts

### 1. Case-Insensitive Parameter Lookup
```typescript
import { NodeOperationError } from 'n8n-workflow';

// Example from BaseOperation class
protected async getParameter(parameterName: string, itemIndex: number): Promise<unknown> {
    try {
        return getParameterInsensitive(this.context, parameterName, itemIndex);
    } catch (error) {
        const metadata = getEntityMetadata(this.entityType);
        const isParentIdParam = metadata?.parentIdField?.toLowerCase() === parameterName.toLowerCase();
        if (!isParentIdParam) {
            throw new NodeOperationError(this.context.getNode(),
                ERROR_TEMPLATES.validation
                    .replace('{type}', 'ValidationError')
                    .replace('{entity}', this.entityType)
                    .replace('{details}', (error as Error).message)
            );
        }
        throw new NodeOperationError(this.context.getNode(),
            ERROR_TEMPLATES.validation
                .replace('{type}', 'ValidationError')
                .replace('{entity}', this.entityType)
                .replace('{details}', `Parent ID field ${parameterName} must be provided explicitly`)
        );
    }
}
```

### 2. ID Field Standardisation
- Entity IDs use lowercase `id`
- Parent IDs use camelCase `{parentType}Id` (e.g., `companyId`, `projectId`)
- Child resource IDs follow the parent naming convention

### 3. Parameter Validation Rules
- Required parameters must be explicitly provided
- Parent IDs must be validated for child resources
- Parameter types must match expected types (string, number, etc.)
- Empty values are invalid for required fields

### 4. Parent Chain Validation
```typescript
import { NodeOperationError } from 'n8n-workflow';

// Example from BaseOperation class
protected async getParentChainIds(itemIndex: number): Promise<Array<{ type: string; id: string | number }>> {
    if (!this.parentChain?.length) {
        return [];
    }

    const chainIds: Array<{ type: string; id: string | number }> = [];
    for (const parentType of this.parentChain) {
        const parentId = await this.getParameter(`${parentType}Id`, itemIndex);
        if (typeof parentId !== 'string' && typeof parentId !== 'number') {
            throw new NodeOperationError(this.context.getNode(),
                ERROR_TEMPLATES.validation
                    .replace('{type}', 'ValidationError')
                    .replace('{entity}', this.entityType)
                    .replace('{details}', `Invalid parent ID type for ${parentType} in chain`)
            );
        }
        chainIds.push({ type: parentType, id: parentId });
    }
    return chainIds;
}
```

## Parameter Processing

### 1. Default Value Handling
- Do not fabricate default values for required inputs
- Use `null` for optional reference fields
- Use `false` for optional boolean fields
- Use `0` for optional numeric fields when appropriate

### 2. Parameter Normalisation
- Convert string IDs to numbers where required
- Trim whitespace from string values
- Convert date strings to proper ISO format
- Handle timezone conversions as needed

### 3. Required Field Validation
- Check field metadata for required flag
- Validate parent ID fields for child resources
- Ensure all required fields are provided
- Handle conditional required fields

### 4. Parameter Type Conversion
```typescript
// Example parameter type conversion
function convertParameterValue(value: unknown, expectedType: string): unknown {
    if (value === undefined || value === null) {
        return null;
    }

    switch (expectedType) {
        case 'number':
            return Number(value);
        case 'boolean':
            return Boolean(value);
        case 'string':
            return String(value);
        case 'date':
            return new Date(value as string).toISOString();
        default:
            return value;
    }
}
```

## Best Practices

### 1. Parameter Naming
- Use camelCase for parameter names (`companyId`) to match n8n patterns
- Follow Autotask API naming conventions where relevant
- Use descriptive names for clarity
- Document parameter purpose and format

### 2. Error Handling
- Provide clear error messages for invalid parameters
- Include parameter name in error messages
- Specify expected vs received value types
- Throw `NodeOperationError` on validation failures

### 3. Parameter Documentation
- Document expected parameter types
- Specify required vs optional parameters
- Include format requirements
- Provide example values

### 4. Parameter Validation
- Validate parameters before processing
- Check for required fields
- Verify parameter types
- Validate parent-child relationships

## Implementation Examples

### 1. Basic Parameter Handling
```typescript
// Example of basic parameter handling
async function processParameters(params: IDataObject, requiredFields: string[]): Promise<void> {
    // Check for required fields
    for (const field of requiredFields) {
        if (params[field] === undefined) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    // Normalise parameter values
    for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string') {
            params[key] = value.trim();
        }
    }
}
```

### 2. Parent-Child Parameter Handling
```typescript
// Example of parent-child parameter handling
async function validateParentChildParams(
    parentType: string,
    parentId: string | number,
    childType: string
): Promise<void> {
    // Validate parent exists
    const parent = await getEntityMetadata(parentType);
    if (!parent) {
        throw new Error(`Invalid parent type: ${parentType}`);
    }

    // Validate child is allowed
    const allowedChildren = parent.childResources?.map(r => r.name) || [];
    if (!allowedChildren.includes(childType)) {
        throw new Error(`${childType} is not a valid child resource of ${parentType}`);
    }

    // Validate parent ID format
    if (typeof parentId !== 'string' && typeof parentId !== 'number') {
        throw new Error(`Invalid parent ID format for ${parentType}`);
    }
}
```

### 3. Complex Parameter Validation
```typescript
// Example of complex parameter validation
async function validateComplexParameters(
    params: IDataObject,
    entityType: string
): Promise<void> {
    const metadata = getEntityMetadata(entityType);
    if (!metadata) {
        throw new Error(`Invalid entity type: ${entityType}`);
    }

    // Validate parent chain if present
    if (metadata.parentChain?.length) {
        for (const parentType of metadata.parentChain) {
            const parentId = params[`${parentType}Id`];
            if (!parentId) {
                throw new Error(`Missing required parent ID for ${parentType}`);
            }
        }
    }

    // Validate operation-specific parameters
    if (params.operation === 'create') {
        const requiredFields = metadata.requiredFields?.create || [];
        for (const field of requiredFields) {
            if (params[field] === undefined) {
                throw new Error(`Missing required field for create: ${field}`);
            }
        }
    }
}
```
