# Error Handling Patterns in Autotask Integration

This document describes the error handling patterns used in the Autotask integration for n8n.

## Overview

The integration implements a comprehensive error handling system that includes:
- Centralized error handling through the `handleErrors` utility
- Consistent error message templates
- Operation-specific error context
- Rate limiting and retry logic
- Validation error handling

## Error Handling Structure

### Core Error Handler (preferred)

```typescript
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

async function handleErrors<T>(
  context: IExecuteFunctions,
  operation: () => Promise<T>,
  errorContext: {
    operation: string;
    entityType: string;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Wrap with n8n error classes; prefer NodeApiError if HTTP context is present
    const isHttp = (error as any)?.response?.status !== undefined;
    const message = formatErrorMessage(error as Error, errorContext);

    const wrapped = isHttp
      ? new NodeApiError(context.getNode(), error as Error, {
          message,
          httpCode: (error as any)?.response?.status,
          ...errorContext,
        })
      : new NodeOperationError(context.getNode(), message, { cause: error as Error, ...errorContext });

    throw wrapped;
  }
}
```

## Error Message Templates

```typescript
const ERROR_TEMPLATES = {
  validation: '[{type}] {entity}: {details}',
  notFound: '[{type}] {entity} not found: {details}',
  unauthorized: '[{type}] Unauthorized access to {entity}: {details}',
  rateLimit: '[{type}] Rate limit exceeded for {entity}: {details}',
  network: '[{type}] Network error accessing {entity}: {details}',
  unknown: '[{type}] Unknown error with {entity}: {details}'
};
```

## Operation-Specific Error Handling

### CRUD Operations

```typescript
// Create operation error handling
try {
  const response = await handleErrors(
    context,
    async () => {
      // Create operation code
    },
    {
      operation: 'create',
      entityType: 'Company'
    }
  );
} catch (error) {
  // Handle specific create operation errors
}

// Update operation error handling
try {
  const response = await handleErrors(
    context,
    async () => {
      // Update operation code
    },
    {
      operation: 'update',
      entityType: 'Company'
    }
  );
} catch (error) {
  // Handle specific update operation errors
}
```

### Attachment Operations

```typescript
// Upload attachment error handling
try {
  const response = await handleErrors(
    context,
    async () => {
      // Validate file size
      if (data.size > MAX_ATTACHMENT_SIZE) {
        throw new NodeOperationError(context.getNode(), `File size exceeds maximum allowed size of ${MAX_ATTACHMENT_SIZE} bytes`);
      }
      // Upload operation code
    },
    {
      operation: 'upload',
      entityType: 'TaskAttachment'
    }
  );
} catch (error) {
  // Handle specific upload errors
}
```

### Parent/Child Operations

```typescript
// Child resource error handling
try {
  const response = await handleErrors(
    context,
    async () => {
      // Validate parent exists
      const parentId = await this.getParameter(`${this.parentType}Id`, itemIndex);
      if (!parentId) {
        throw new NodeOperationError(context.getNode(), `Parent ${this.parentType} ID is required`);
      }
      // Operation code
    },
    {
      operation: 'create',
      entityType: 'Task'
    }
  );
} catch (error) {
  // Handle specific child resource errors
}
```

## Validation Error Handling

### Parameter Validation

```typescript
// Parameter validation error handling
try {
  const value = await handleErrors(
    context,
    async () => {
      return await this.getParameter('parameterName', itemIndex);
    },
    {
      operation: 'validation',
      entityType: this.entityType
    }
  );
} catch (error) {
  // Handle parameter validation errors
}
```

### Field Validation

```typescript
// Field validation error handling
try {
  const processedValue = await handleErrors(
    context,
    async () => {
      return await this.processFieldValues(value);
    },
    {
      operation: 'fieldValidation',
      entityType: this.entityType
    }
  );
} catch (error) {
  // Handle field validation errors
}
```

## Rate Limiting

### Rate Limit Detection

```typescript
function isRateLimitError(error: any): boolean {
  return error?.response?.status === 429;
}
```

### Retry Logic (exponential backoff with jitter and Retry-After)

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
  }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (!isRateLimitError(error)) throw error;

      const retryAfterHeader = (error as any)?.response?.headers?.['retry-after'];
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
      const expo = Math.min(options.baseDelayMs * Math.pow(2, attempt - 1), options.maxDelayMs);
      const jitter = Math.random() * (expo * 0.2);
      const delay = retryAfterMs ?? Math.round(expo + jitter);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
```

## Error Context Management

### Adding Context

```typescript
function enhanceErrorContext(
  error: Error,
  context: {
    operation: string;
    entityType: string;
    details?: Record<string, unknown>;
  }
): Error {
  (error as any).context = {
    ...(error as any).context,
    ...context,
    timestamp: new Date().toISOString()
  };
  return error;
}
```

### Error Logging

```typescript
function logError(
  error: Error,
  context: IExecuteFunctions
): void {
  console.error('Operation failed:', {
    message: error.message,
    context: (error as any).context,
    stack: error.stack
  });
}
```

## Best Practices

1. **Use n8n error classes**
   - Prefer `NodeApiError` for HTTP errors and `NodeOperationError` for logical/validation errors
   - Avoid mutating `error.message`; wrap and preserve the original error as `cause`
   - Include operation and entity type context

2. **Validation First**
   - Validate parameters before making API calls
   - Check parent/child relationships
   - Verify entity capabilities

3. **Specific Error Messages**
   - Use error templates consistently
   - Include attempted values in validation errors
   - Provide clear resolution steps

4. **Rate Limit Handling**
   - Detect via HTTP 429
   - Implement exponential backoff with jitter
   - Honor `Retry-After` when present

5. **Error Context**
   - Include operation context
   - Add timestamp information
   - Preserve error chain via `cause`

6. **Debugging Support**
   - Log appropriate debug information
   - Include request/response details when available
   - Maintain error stack traces
