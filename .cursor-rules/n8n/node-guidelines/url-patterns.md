# URL Patterns in Autotask Integration

This document describes the URL patterns used in the Autotask integration for n8n.

## Overview

The integration supports various URL patterns for different types of operations:
- Standard entity operations
- Child resource operations
- Nested resource operations
- Attachment operations
- Query operations
- Count operations

## Standard Entity URLs

Basic entity operations use the following pattern:
```
/{version}/{entityName}
/{version}/{entityName}/{id}
```

Example:
```
/v1.0/Companies
/v1.0/Companies/123
```

## Child Resource URLs

Child resources (resources that belong to a parent entity) use:
```
/{version}/{parentEntity}/{parentId}/{childResourceName}
/{version}/{parentEntity}/{parentId}/{childResourceName}/{childId}
```

Example:
```
/v1.0/Projects/456/Tasks
/v1.0/Projects/456/Tasks/789
```

## Nested Resource URLs

Deeply nested resources follow the full parent chain:
```
/{version}/{parentEntity1}/{parentId1}/{parentEntity2}/{parentId2}/{resourceName}
```

Example:
```
/v1.0/Companies/123/CompanyNotes/456/Attachments
```

## Attachment URLs

Attachment operations have special URL patterns:
```
/{version}/{entityName}/{entityId}/Attachments                # List attachments
/{version}/{entityName}/{entityId}/Attachments/{id}           # Get attachment metadata
/{version}/{entityName}/{entityId}/Attachments/{id}/data      # Get attachment content
```

Example:
```
/v1.0/Tasks/123/Attachments
/v1.0/Tasks/123/Attachments/456
/v1.0/Tasks/123/Attachments/456/data
```

## Query URLs

Query operations append '/query' to the base URL:
```
/{version}/{entityName}/query
```

Example:
```
/v1.0/Companies/query
```

## Count URLs

Count operations append '/count' to the base URL:
```
/{version}/{entityName}/count
```

Example:
```
/v1.0/Tasks/count
```

## URL Construction

URLs are constructed using the following helper functions:

### buildEntityUrl
Used for standard entity operations, with options for:
- Entity ID
- Query operations
- Count operations
- Attachment operations
- Parent chain for nested resources

### buildChildEntityUrl
Used for child resource operations, with support for:
- Parent entity and ID
- Child resource name
- Child ID
- Attachment operations
- Nested resource chains

## Special Considerations

1. **Pluralisation**
   - Entity names are automatically pluralised in URLs
   - Proper handling of irregular plurals is supported

2. **Parent Chain Validation**
   - Parent chains are validated before URL construction
   - Each link in the chain must have a valid type and ID

3. **Attachment Handling**
   - Use `/data` for attachment content download endpoints
   - Attachment operations require both the parent entity ID and the attachment ID

4. **Query Parameters**
   - Support for filtering and pagination
   - Proper encoding of query parameters

## Error Handling

The URL construction includes validation for:
- Invalid entity types
- Missing required IDs
- Invalid parent chains
- Unsupported operations
- Malformed URLs

## Examples

### Standard Entity
```typescript
buildEntityUrl('Company', { entityId: '123' })
// Result: /v1.0/Companies/123
```

### Child Resource
```typescript
buildChildEntityUrl('Project', 'Task', '456')
// Result: /v1.0/Projects/456/Tasks
```

### Nested Resource
```typescript
buildEntityUrl('CompanyNoteAttachment', {
  parentChain: [
    { type: 'Company', id: '123' },
    { type: 'CompanyNote', id: '456' }
  ]
})
// Result: /v1.0/Companies/123/CompanyNotes/456/Attachments
```

### Query Operation
```typescript
buildEntityUrl('Task', { isQuery: true })
// Result: /v1.0/Tasks/query
```

### Count Operation
```typescript
buildEntityUrl('Company', { isCount: true })
// Result: /v1.0/Companies/count
```

### Attachment Operation
```typescript
buildEntityUrl('TaskAttachment', {
  entityId: '123',
  attachmentId: '789',
  isAttachment: true,
  isAttachmentData: true
})
// Result: /v1.0/Tasks/123/Attachments/789/data
```
