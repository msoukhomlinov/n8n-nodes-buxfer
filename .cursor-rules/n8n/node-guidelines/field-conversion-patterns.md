# Field Conversion Patterns in Autotask Integration

This document describes the field conversion patterns used in the Autotask integration for n8n.

## Overview

The field conversion system handles:
- Type conversion between n8n and Autotask
- Date/time format standardisation (ISO 8601)
- Reference field resolution
- Picklist value mapping
- User-defined field (UDF) conversion

## Type Conversion

### Basic Type Mapping

```typescript
interface ITypeConversionContext {
  direction: 'read' | 'write';
  operation: OperationType;
  entityType: string;
}

function convertFieldValue(
  field: IEntityField,
  value: unknown,
  context: ITypeConversionContext
): unknown {
  if (value === null || value === undefined) {
    // Do not coerce required values to empty strings. Validation should catch missing required values upstream.
    return null;
  }

  switch (field.dataType) {
    case 'string':
      return String(value);
    case 'integer':
    case 'long':
      return Number.parseInt(String(value), 10);
    case 'double':
    case 'decimal':
      return Number.parseFloat(String(value));
    case 'boolean':
      return Boolean(value);
    case 'dateTime':
    case 'date':
      return convertDateTime(value, field.dataType);
    default:
      return String(value);
  }
}
```

## Date/Time Handling

### Date Conversion

```typescript
function convertDateTime(
  value: unknown,
  type: 'date' | 'dateTime'
): string {
  if (typeof value === 'string' || value instanceof Date) {
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid date value: ${value}`);
    }
    return type === 'date' ? date.toISOString().split('T')[0] : date.toISOString();
  }
  throw new Error(`Invalid date value: ${value}`);
}
```

### Timezone Handling

```typescript
function handleTimezone(
  date: Date,
  timezone: string
): Date {
  const targetDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const offset = targetDate.getTimezoneOffset();
  return new Date(targetDate.getTime() - offset * 60 * 1000);
}
```

## Reference Field Processing

### Reference Resolution

```typescript
async function resolveReference(
  field: IEntityField,
  value: unknown,
  context: ITypeConversionContext
): Promise<unknown> {
  if (!field.isReference || !field.referenceEntityType) return value;

  if (typeof value === 'number') return value;

  if (typeof value === 'string' && value.trim().length > 0) {
    const entity = await findReferenceByName(field.referenceEntityType, value);
    return entity?.id;
  }
  throw new Error(`Invalid reference value for ${field.name}: ${value}`);
}
```

### Reference Loading

```typescript
async function loadReferenceValues(
  field: IEntityField
): Promise<INodePropertyOptions[]> {
  if (!field.isReference || !field.referenceEntityType) return [];
  const entities = await queryReferenceEntities(field.referenceEntityType);
  return entities.map(entity => ({
    name: entity.name,
    value: entity.id,
    description: entity.description
  }));
}
```

## Picklist Value Mapping

### Value Conversion

```typescript
function convertPicklistValue(
  field: IEntityField,
  value: unknown
): unknown {
  if (!field.isPickList || !field.picklistValues) return value;

  if (typeof value === 'number') {
    const picklistValue = field.picklistValues.find(pv => pv.value === value);
    return picklistValue?.value ?? value;
  }

  if (typeof value === 'string') {
    const picklistValue = field.picklistValues.find(
      pv => pv.label.toLowerCase() === value.toLowerCase()
    );
    return picklistValue?.value ?? value;
  }
  return value;
}
```

### Dependent Picklists

```typescript
async function loadDependentPicklistValues(
  field: IEntityField,
  parentValue: unknown
): Promise<INodePropertyOptions[]> {
  if (!field.isPickList || !field.picklistValues || !field.picklistParentValueField) return [];
  const filteredValues = field.picklistValues.filter(pv => pv.parentValue === parentValue);
  return filteredValues.map(value => ({
    name: value.label,
    value: value.value,
    description: value.description
  }));
}
```

## UDF Value Conversion

### UDF Type Handling

```typescript
function convertUdfValue(
  field: IEntityField & { isUdf: true },
  value: unknown
): unknown {
  if (!field.isUdf) return value;

  switch (field.udfType) {
    case 1: // Text
      return String(value);
    case 2: // Number
      return convertNumericUdf(value, field);
    case 3: // Datetime
      return convertDateTime(value, 'dateTime');
    case 4: // Picklist
      return convertPicklistValue(field, value);
    default:
      return value;
  }
}
```

### Numeric UDF Processing

```typescript
function convertNumericUdf(
  value: unknown,
  field: IEntityField & {
    isUdf: true;
    numberOfDecimalPlaces?: number;
  }
): number {
  const num = Number.parseFloat(String(value));
  if (Number.isNaN(num)) throw new Error(`Invalid numeric value for ${field.name}: ${value}`);
  if (field.numberOfDecimalPlaces !== undefined) return Number(num.toFixed(field.numberOfDecimalPlaces));
  return num;
}
```

## Best Practices

1. **Type Safety**
   - Use strict type checking
   - Validate converted values; do not fabricate defaults for required fields

2. **Date/Time Handling**
   - Always use ISO 8601 for storage
   - Handle timezone conversions explicitly

3. **Reference Fields**
   - Cache reference lookups
   - Handle both ID and name inputs

4. **Picklist Values**
   - Support both value and label inputs
   - Handle dependent picklists properly

5. **UDF Conversion**
   - Handle all UDF types consistently
   - Respect decimal place settings

6. **Performance**
   - Cache field definitions
   - Batch reference resolutions
   - Optimize validation checks
