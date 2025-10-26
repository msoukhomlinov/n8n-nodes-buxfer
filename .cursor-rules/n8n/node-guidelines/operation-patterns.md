# Operation Patterns in Autotask Integration

This document describes the operation patterns used in the Autotask integration for n8n.

## Overview

The integration supports several operation patterns:
- CRUD Operations (Create, Read, Update, Delete)
- Count Operations
- Attachment Operations
- Parent/Child Operations
- Nested Resource Operations

## CRUD Operations

### Create (POST)
```typescript
// Standard entity creation
const response = await autotaskApiRequest.call(
  context,
  'POST',
  endpoint,
  data
);

// With parent context
const response = await autotaskApiRequest.call(
  context,
  'POST',
  `/v1.0/Projects/${projectId}/Tasks`,
  data
);
```

### Read (GET)
```typescript
// Single entity
const response = await autotaskApiRequest.call(
  context,
  'GET',
  `/v1.0/Companies/${id}`
);

// List entities
const response = await autotaskApiRequest.call(
  context,
  'GET',
  '/v1.0/Companies'
);

// With filtering (POST query)
const response = await autotaskApiRequest.call(
  context,
  'POST',
  '/v1.0/Companies/query',
  { filter: [...] }
);
```

### Update (PATCH/PUT)
```typescript
// Partial update (PATCH)
const response = await autotaskApiRequest.call(
  context,
  'PATCH',
  `/v1.0/Companies/${id}`,
  updates
);

// Full update (PUT)
const response = await autotaskApiRequest.call(
  context,
  'PUT',
  `/v1.0/Companies/${id}`,
  fullData
);
```

### Delete (DELETE)
```typescript
await autotaskApiRequest.call(
  context,
  'DELETE',
  `/v1.0/Companies/${id}`
);
```

## Count Operations

Count operations use a POST request with a filter:
```typescript
const response = await autotaskApiRequest.call(
  context,
  'POST',
  '/v1.0/Tasks/count',
  { filter: [] }
);
```

## Attachment Operations

### Upload Attachment
```typescript
const response = await autotaskApiRequest.call(
  context,
  'POST',
  `/v1.0/Tasks/${taskId}/Attachments`,
  {
    title: 'Document.pdf',
    data: base64Data,
    contentType: 'application/pdf',
    fileName: 'Document.pdf',
    publish: true
  }
);
```

### Download Attachment
```typescript
const response = await autotaskApiRequest.call(
  context,
  'GET',
  `/v1.0/Tasks/${taskId}/Attachments/${attachmentId}/data`
);
```

### Delete Attachment
```typescript
await autotaskApiRequest.call(
  context,
  'DELETE',
  `/v1.0/Tasks/${taskId}/Attachments/${attachmentId}`
);
```

## Parent/Child Operations

### List Child Resources
```typescript
const response = await autotaskApiRequest.call(
  context,
  'GET',
  `/v1.0/Projects/${projectId}/Tasks`
);
```

### Create Child Resource
```typescript
const response = await autotaskApiRequest.call(
  context,
  'POST',
  `/v1.0/Projects/${projectId}/Tasks`,
  childData
);
```

### Update Child Resource
```typescript
const response = await autotaskApiRequest.call(
  context,
  'PATCH',
  `/v1.0/Projects/${projectId}/Tasks/${taskId}`,
  updates
);
```

## Nested Resource Operations

### List Nested Resources
```typescript
const response = await autotaskApiRequest.call(
  context,
  'GET',
  `/v1.0/Companies/${companyId}/CompanyNotes/${noteId}/Attachments`
);
```

### Create Nested Resource
```typescript
const response = await autotaskApiRequest.call(
  context,
  'POST',
  `/v1.0/Companies/${companyId}/CompanyNotes/${noteId}/Attachments`,
  resourceData
);
```

## Error Handling

All operations include comprehensive error handling:

```typescript
try {
  const response = await handleErrors(
    context,
    async () => {
      // Operation code here
    },
    {
      operation: 'create',
      entityType: 'Company'
    }
  );
} catch (error) {
  // Error handling
}
```

## Special Considerations

1. **Parameter Validation**
   - All required parameters are validated before operation execution
   - Parent IDs are validated for child/nested operations
   - Attachment operations validate file size and type

2. **Response Processing**
   - Date fields are automatically converted to appropriate formats (ISO 8601)
   - Responses are typed according to entity definitions
   - Pagination is handled automatically for list operations

3. **Operation Context**
   - Each operation maintains its context for error handling
   - Parent/child relationships are preserved across operations
   - Attachment context includes metadata handling

4. **Rate Limiting**
   - Detect 429 and apply exponential backoff with jitter, honouring Retry-After
   - Batch operations where appropriate

## Implementation Examples

### Basic CRUD Operation
```typescript
class CompanyOperation extends BaseOperation {
  async create(itemIndex: number): Promise<IAutotaskEntity> {
    const data = await this.processFieldValues(
      await this.getParameter('data', itemIndex)
    );
    const endpoint = await this.buildOperationUrl(itemIndex);

    return await handleErrors(
      this.context,
      async () => {
        const response = await autotaskApiRequest.call(
          this.context,
          'POST',
          endpoint,
          data
        );
        return response.item;
      },
      {
        operation: 'create',
        entityType: this.entityType
      }
    );
  }
}
```

### Nested Resource Operation
```typescript
class CompanyNoteAttachmentOperation extends BaseOperation {
  async create(itemIndex: number): Promise<IAutotaskEntity> {
    const parentChain = await this.getParentChainIds(itemIndex);
    const data = await this.processFieldValues(
      await this.getParameter('data', itemIndex)
    );

    const endpoint = await this.buildOperationUrl(itemIndex, {
      parentChain
    });

    return await handleErrors(
      this.context,
      async () => {
        const response = await autotaskApiRequest.call(
          this.context,
          'POST',
          endpoint,
          data
        );
        return response.item;
      },
      {
        operation: 'create',
        entityType: this.entityType
      }
    );
  }
}
```
