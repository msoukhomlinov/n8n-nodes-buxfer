/**
 * Structured error/success envelope for Buxfer AI Tools.
 *
 * All tool responses use a stable envelope so LLMs can reliably parse results.
 * Call sites always use `JSON.stringify(wrapSuccess/wrapError(...))`.
 */

// ---------------------------------------------------------------------------
// Envelope interfaces
// ---------------------------------------------------------------------------
interface ToolEnvelope {
	schemaVersion: '1';
	tool: string;
	resource: string;
	operation: string;
	success: boolean;
}

export interface SuccessEnvelope extends ToolEnvelope {
	success: true;
	result: Record<string, unknown>;
}

export interface ErrorEnvelope extends ToolEnvelope {
	success: false;
	error: {
		errorType: string;
		message: string;
		nextAction: string;
		context?: Record<string, unknown>;
	};
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TOOL_NAME_PREFIX = 'buxfer';

export const ERROR_TYPES = {
	API_ERROR: 'API_ERROR',
	ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
	NO_RESULTS_FOUND: 'NO_RESULTS_FOUND',
	MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
	MISSING_ENTITY_ID: 'MISSING_ENTITY_ID',
	INVALID_OPERATION: 'INVALID_OPERATION',
	WRITE_OPERATION_BLOCKED: 'WRITE_OPERATION_BLOCKED',
	PERMISSION_DENIED: 'PERMISSION_DENIED',
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------
function toolName(resource: string): string {
	return `${TOOL_NAME_PREFIX}_${resource}`;
}

export function wrapSuccess(
	resource: string,
	operation: string,
	result: Record<string, unknown>,
): SuccessEnvelope {
	return {
		schemaVersion: '1',
		tool: toolName(resource),
		resource,
		operation,
		success: true,
		result,
	};
}

export function wrapError(
	resource: string,
	operation: string,
	errorType: string,
	message: string,
	nextAction: string,
	context?: Record<string, unknown>,
): ErrorEnvelope {
	return {
		schemaVersion: '1',
		tool: toolName(resource),
		resource,
		operation,
		success: false,
		error: {
			errorType,
			message,
			nextAction,
			...(context ? { context } : {}),
		},
	};
}

// ---------------------------------------------------------------------------
// Convenience wrappers (thin delegates to wrapError)
// ---------------------------------------------------------------------------
export function formatApiError(
	resource: string,
	operation: string,
	message: string,
): ErrorEnvelope {
	return wrapError(
		resource,
		operation,
		ERROR_TYPES.API_ERROR,
		message,
		'Verify parameter names and values, then retry.',
	);
}

export function formatMissingIdError(
	resource: string,
	operation: string,
): ErrorEnvelope {
	return wrapError(
		resource,
		operation,
		ERROR_TYPES.MISSING_ENTITY_ID,
		`A numeric ID is required for ${operation}.`,
		`Use buxfer_${resource} with operation 'getAll' to find the ID first.`,
	);
}

export function formatNotFoundError(
	resource: string,
	operation: string,
	id: number | string,
): ErrorEnvelope {
	return wrapError(
		resource,
		operation,
		ERROR_TYPES.ENTITY_NOT_FOUND,
		`${resource} with id ${id} was not found.`,
		`Verify the ID. Use buxfer_${resource} with operation 'getAll' to list available ${resource}s.`,
	);
}

export function formatNoResultsFound(
	resource: string,
	operation: string,
	filtersUsed: Record<string, unknown>,
): ErrorEnvelope {
	return wrapError(
		resource,
		operation,
		ERROR_TYPES.NO_RESULTS_FOUND,
		`No ${resource}s matched the given filters.`,
		`Broaden your filters or use buxfer_${resource} with operation 'getAll' without filters to list all.`,
		{ filtersUsed },
	);
}
