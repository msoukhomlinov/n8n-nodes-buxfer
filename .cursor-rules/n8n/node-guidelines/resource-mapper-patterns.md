# Resource Mapper Patterns in Autotask Integration

This document describes the resource mapper patterns used in the Autotask integration for n8n.

## Overview

The resource mapper handles field mapping between n8n and Autotask, including:
- Field type conversion
- Default field matching
- UI state management
- Validation rules
- User-defined fields (UDF) support

## Field Mapping Configuration

### Base Field Interface

```typescript
interface IBaseField {
  name: string;
  displayName: string;
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
  options?: INodePropertyOptions[];
}

interface IResourceMapperField extends IBaseField {
  defaultMatch: boolean;
  canBeUsedToMatch?: boolean;
  removed?: boolean;
}
```

### Field Type Mapping

```typescript
function mapFieldType(
  field: IEntityField,
  context: IFieldMappingContext
): string {
  if (field.isPickList) {
    return 'options';
  }

  switch (field.dataType) {
    case 'string':
      return 'string';
    case 'integer':
    case 'long':
      return 'number';
    case 'double':
    case 'decimal':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'dateTime':
    case 'date':
      return 'dateTime';
    default:
      return 'string';
  }
}
```

## Default Matching Rules

```typescript
function determineDefaultMatch(field: IEntityField): boolean {
  // Common identifier fields are default matches
  if (field.name.toLowerCase().includes('id')) {
    return true;
  }

  // Required fields are default matches
  if (field.isRequired) {
    return true;
  }

  // Name fields are default matches
  if (field.name.toLowerCase().includes('name')) {
    return true;
  }

  return false;
}
```

## Field State Management

### Tracking Removed Fields

```typescript
interface IFieldState {
  removed: boolean;
  originalValues?: unknown;
}

function updateFieldState(
  field: ResourceMapperField,
  state: IFieldState
): void {
  field.removed = state.removed;
  
  if (state.removed) {
    // Store original values for potential restoration
    field.originalValues = {
      defaultMatch: field.defaultMatch,
      canBeUsedToMatch: field.canBeUsedToMatch
    };
  } else if (field.originalValues) {
    // Restore original values
    field.defaultMatch = field.originalValues.defaultMatch;
    field.canBeUsedToMatch = field.originalValues.canBeUsedToMatch;
  }
}
```

### Handling UI Updates

```typescript
function handleFieldUpdate(
  field: ResourceMapperField,
  updates: Partial<ResourceMapperField>
): void {
  // Update field properties
  Object.assign(field, updates);

  // Handle removal state
  if (updates.removed !== undefined) {
    updateFieldState(field, { removed: updates.removed });
  }

  // Update matching capability
  if (!field.removed && updates.canBeUsedToMatch !== undefined) {
    field.canBeUsedToMatch = updates.canBeUsedToMatch;
  }
}
```

## Validation Rules

### Field Validation

```typescript
interface IFieldValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  uniqueItems?: boolean;
}

function validateField(
  field: IEntityField,
  value: unknown
): string[] {
  const errors: string[] = [];

  // Required field validation
  if (field.isRequired && (value === undefined || value === null)) {
    errors.push(`${field.label} is required`);
  }

  // String length validation
  if (field.dataType === 'string' && typeof value === 'string') {
    if (field.length && value.length > field.length) {
      errors.push(
        `${field.label} must not exceed ${field.length} characters`
      );
    }
  }

  // Numeric range validation
  if (
    (field.dataType === 'integer' || field.dataType === 'double') &&
    typeof value === 'number'
  ) {
    if (field.minimum !== undefined && value < field.minimum) {
      errors.push(
        `${field.label} must be greater than or equal to ${field.minimum}`
      );
    }
    if (field.maximum !== undefined && value > field.maximum) {
      errors.push(
        `${field.label} must be less than or equal to ${field.maximum}`
      );
    }
  }

  return errors;
}
```

## User-Defined Fields Support

### UDF Field Configuration

```typescript
interface IUdfField extends IEntityField {
  isUdf: true;
  udfType: number;
  displayFormat?: number;
  isEncrypted?: boolean;
  isPrivate?: boolean;
  isProtected?: boolean;
  numberOfDecimalPlaces?: number;
}

function configureUdfField(
  field: IUdfField,
  context: IFieldMappingContext
): ResourceMapperField {
  return {
    name: field.name,
    displayName: field.label,
    type: mapUdfType(field.udfType),
    required: field.isRequired,
    description: field.description || undefined,
    defaultMatch: false,
    canBeUsedToMatch: !field.isEncrypted && !field.isPrivate,
    // Additional UDF-specific properties
    isUdf: true,
    udfType: field.udfType,
    displayFormat: field.displayFormat,
    isEncrypted: field.isEncrypted,
    isPrivate: field.isPrivate,
    isProtected: field.isProtected,
    numberOfDecimalPlaces: field.numberOfDecimalPlaces
  };
}
```

## Implementation Examples

### Basic Field Mapping

```typescript
class CompanyOperation extends BaseOperation {
  async getFieldOptions(): Promise<INodePropertyOptions[]> {
    const fields = await this.getEntityFields();
    
    return fields
      .filter(field => !field.removed)
      .map(field => ({
        name: field.label,
        value: field.name,
        description: field.description
      }));
  }

  async mapFieldsToProperties(
    fields: IEntityField[]
  ): Promise<INodeProperties[]> {
    return fields
      .filter(field => !field.removed)
      .map(field => ({
        displayName: field.label,
        name: field.name,
        type: this.mapFieldType(field),
        default: field.defaultValue,
        required: field.isRequired,
        description: field.description
      }));
  }
}
```

### Complex Field Mapping

```typescript
class TaskOperation extends BaseOperation {
  async mapFieldsWithRelations(
    fields: IEntityField[]
  ): Promise<INodeProperties[]> {
    const properties: INodeProperties[] = [];

    for (const field of fields) {
      if (field.removed) continue;

      const property: INodeProperties = {
        displayName: field.label,
        name: field.name,
        type: this.mapFieldType(field),
        default: field.defaultValue,
        required: field.isRequired,
        description: field.description
      };

      // Handle reference fields
      if (field.isReference && field.referenceEntityType) {
        property.typeOptions = {
          loadOptionsMethod: 'getReference',
          loadOptionsDependsOn: [field.referenceEntityType]
        };
      }

      // Handle dependent picklists
      if (
        field.isPickList &&
        field.picklistParentValueField
      ) {
        property.typeOptions = {
          loadOptionsMethod: 'getPicklistValues',
          loadOptionsDependsOn: [field.picklistParentValueField]
        };
      }

      properties.push(property);
    }

    return properties;
  }
}
```

## Best Practices

1. **Field State Management**
   - Track removed fields separately from deletion
   - Preserve original values for restoration
   - Handle UI state updates consistently

2. **Validation**
   - Validate fields before mapping
   - Include all required validation rules
   - Handle UDF-specific validation

3. **Type Conversion**
   - Map types consistently
   - Handle special cases (e.g., dates)
   - Support custom type conversions

4. **Default Matching**
   - Use clear rules for default matches
   - Consider field importance
   - Allow override of defaults

5. **UDF Support**
   - Handle UDF fields consistently
   - Support all UDF types
   - Respect UDF security settings

6. **Performance**
   - Cache field definitions
   - Optimize validation checks
   - Minimize API calls
