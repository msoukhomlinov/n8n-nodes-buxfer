# Entity Information Operations

This document describes the operations available for retrieving entity and field information from the Autotask API.

## Operations

### Get Entity Info

Retrieves metadata about an entity type, including:
- Basic entity information
- Supported operations
- Parent/child relationships
- API capabilities

#### Example Usage

```typescript
{
	"resource": "company",
	"operation": "getEntityInfo"
}
```

#### Response Format

```json
{
	"name": "company",
	"metadata": {
		"name": "company",
		"operations": {
			"create": "self",
			"read": "self",
			"update": "self",
			"delete": "self",
			"query": "self"
		},
		"supportedOperations": [
			"get",
			"getMany",
			"query",
			"create",
			"update",
			"delete",
			"udf",
			"webhook"
		]
	},
	"apiInfo": {
		"name": "Company",
		"label": "Company",
		"canCreate": true,
		"canUpdate": true,
		"canDelete": true,
		"canQuery": true,
		"hasUserDefinedFields": true,
		"supportsWebhookCallouts": true,
		"userAccessForCreate": "All",
		"userAccessForDelete": "All",
		"userAccessForQuery": "All",
		"userAccessForUpdate": "All"
	}
}
```

### Get Field Info

Retrieves detailed information about all fields available for an entity, including:
- Standard fields
- User-defined fields (UDF)
- Field metadata and validation rules
- Reference and picklist information

#### Example Usage

```typescript
{
	"resource": "company",
	"operation": "getFieldInfo"
}
```

#### Response Format

```json
{
	"name": "company",
	"metadata": {
		"name": "company",
		"hasUserDefinedFields": true,
		"supportsWebhookCallouts": true
	},
	"standardFields": [
		{
			"name": "id",
			"label": "ID",
			"dataType": "integer",
			"isRequired": false,
			"isReadOnly": true,
			"isQueryable": true,
			"description": "Primary key",
			"isPickList": false,
			"isReference": false,
			"isSupportedWebhookField": true,
			"isActive": true,
			"isSystemField": true
		}
	],
	"udfFields": [
		{
			"name": "customField1",
			"label": "Custom Field 1",
			"dataType": "string",
			"isRequired": false,
			"isReadOnly": false,
			"isQueryable": true,
			"description": "Custom text field",
			"isPickList": false,
			"isReference": false,
			"isSupportedWebhookField": true,
			"isActive": true,
			"isSystemField": false,
			"isUdf": true
		}
	],
	"allFields": [
		// Combined array of standard and UDF fields
	]
}
```

## Implementation Details

### Parent/Child Support

Both operations support parent/child relationships:
- For child entities, include the parent type and ID
- For nested resources, provide the full parent chain
- Parent context is maintained in responses

### Error Handling

Common error scenarios:
- Entity type not found in metadata
- Invalid parent/child relationship
- Missing or invalid parent ID
- API access denied
- Rate limiting

### Best Practices

1. Cache entity and field information when possible
2. Use field information to validate inputs before operations
3. Check operation support before attempting actions
4. Handle UDF fields appropriately in queries
5. Respect field validation rules in updates 
