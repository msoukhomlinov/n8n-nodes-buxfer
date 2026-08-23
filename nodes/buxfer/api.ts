import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  IN8nHttpFullResponse,
  ISupplyDataFunctions,
} from 'n8n-workflow';
import { NodeOperationError, NodeApiError } from 'n8n-workflow';

// Debug flag - set to true to enable console logging
const DEBUG_ENABLED = true;

function debug(message: string, data?: any): void {
  if (DEBUG_ENABLED) {
    if (data !== undefined) {
      // eslint-disable-next-line no-console
      console.log(`[Buxfer Debug] ${message}`, data);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[Buxfer Debug] ${message}`);
    }
  }
}

function isN8nError(error: unknown): boolean {
  return error instanceof NodeApiError || error instanceof NodeOperationError;
}

let tokenCache: string | null = null;
let tokenExpiry: number | null = null;

interface BuxferLoginResponse {
  response: {
    token: string;
  };
}

export async function buxferApiLogin(context: IExecuteFunctions | ILoadOptionsFunctions | ISupplyDataFunctions, email: string, password: string): Promise<string> {
  try {
    const params = new URLSearchParams();
    params.append('email', email);
    params.append('password', password);

    debug('Login request', {
      url: 'https://www.buxfer.com/api/login',
      contentType: 'application/x-www-form-urlencoded',
      hasEmail: !!email,
      hasPassword: !!password,
      formDataLength: params.toString().length
    });

    const response = (await context.helpers.httpRequest({
      method: 'POST',
      url: 'https://www.buxfer.com/api/login',
      body: params,
      ignoreHttpStatusErrors: true,
      returnFullResponse: true,
    })) as IN8nHttpFullResponse;

    debug('Login response', { status: response.statusCode });

    if (response.statusCode === 429) {
      context.logger.error('Login rate limit exceeded');
      throw new NodeOperationError(
        context.getNode(),
        'Rate limit exceeded. Please try again later.'
      );
    }

    if (response.statusCode >= 400) {
      let bodyPreview = '';
      if (response.body !== null && response.body !== undefined) {
        try {
          const raw = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
          if (raw) {
            bodyPreview = ` (body: ${raw.substring(0, 200)})`;
          }
        } catch {
          // Ignore preview serialization failures
        }
      }
      context.logger.error('Login failed', { statusCode: response.statusCode });
      throw new NodeApiError(context.getNode(), { message: `Login failed: HTTP ${response.statusCode}${bodyPreview}` });
    }

    const body = response.body as BuxferLoginResponse;
    debug('Login response body', {
      dataKeys: Object.keys(body || {}),
      hasResponse: !!body?.response,
      hasToken: !!body?.response?.token
    });

    if (body?.response?.token) {
      tokenCache = body.response.token;
      tokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      debug('Login successful - token cached');
      return tokenCache;
    }

    debug('Login failed - invalid response structure', body);
    throw new NodeApiError(context.getNode(), { message: 'Login failed: Invalid response from Buxfer API' });
  } catch (error) {
    if (isN8nError(error)) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.logger.error('Login failed', { message: errorMessage });
    throw new NodeApiError(
      context.getNode(),
      { message: `Login failed: ${errorMessage}` }
    );
  }
}

export async function getValidToken(context: IExecuteFunctions | ILoadOptionsFunctions | ISupplyDataFunctions): Promise<string> {
  if (tokenCache && tokenExpiry && Date.now() < tokenExpiry) {
    debug('Using cached token', {
      expiresInMinutes: Math.round((tokenExpiry - Date.now()) / 1000 / 60)
    });
    return tokenCache;
  }

  debug('No valid cached token, logging in...');
  const credentials = await context.getCredentials('buxferApi');
  const email = credentials.email as string;
  const password = credentials.password as string;

  return await buxferApiLogin(context, email, password);
}

export async function buxferApiRequest(
  context: IExecuteFunctions | ILoadOptionsFunctions | ISupplyDataFunctions,
  method: 'GET' | 'POST',
  endpoint: string,
  data?: any
): Promise<any> {
  let response: IN8nHttpFullResponse;

  try {
    const token = await getValidToken(context);
    const url = `https://www.buxfer.com/api${endpoint}`;

    debug('API request', {
      method,
      endpoint,
      url,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : []
    });

    const buildOptions = (requestToken: string): IHttpRequestOptions => {
      const options: IHttpRequestOptions = {
        method,
        url,
        ignoreHttpStatusErrors: true,
        returnFullResponse: true,
      };

      if (method === 'GET') {
        // For GET requests, add token and data as query parameters
        const qs: IDataObject = { token: requestToken };
        if (data) {
          Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              qs[key] = String(value);
            }
          });
        }
        options.qs = qs;
        debug('GET request query', { qs });
      } else {
        // For POST requests, add token to query and data as form-encoded body
        options.qs = { token: requestToken };

        if (data) {
          const params = new URLSearchParams();
          Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              // Special handling for JSON objects and arrays (payers, sharers)
              if (typeof value === 'object') {
                params.append(key, JSON.stringify(value));
              } else {
                params.append(key, String(value));
              }
            }
          });
          options.body = params;
          const encoded = params.toString();
          debug('POST request data', {
            dataLength: encoded.length,
            dataPreview: encoded.substring(0, 200) + (encoded.length > 200 ? '...' : '')
          });
        }
        debug('POST request query', { qs: options.qs });
      }

      return options;
    };

    let options = buildOptions(token);

    debug('Making API request...');
    response = (await context.helpers.httpRequest(options)) as IN8nHttpFullResponse;

    if (response.statusCode === 401) {
      debug('Token expired, retrying with new token...');
      // Token expired, clear cache and retry once
      tokenCache = null;
      tokenExpiry = null;
      const newToken = await getValidToken(context);

      options = buildOptions(newToken);
      response = (await context.helpers.httpRequest(options)) as IN8nHttpFullResponse;
      debug('Retry successful');
    }
  } catch (error) {
    if (isN8nError(error)) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.logger.error('Buxfer API request failed', { message: errorMessage, method, endpoint });
    throw new NodeOperationError(
      context.getNode(),
      `Buxfer API request failed: ${errorMessage}`
    );
  }

  let dataPreview = '';
  try {
    dataPreview = JSON.stringify(response.body, null, 2)?.substring(0, 500) + '...';
  } catch {
    // Ignore preview serialization failures
  }
  debug('API response', {
    status: response.statusCode,
    statusText: response.statusMessage,
    dataKeys: response.body && typeof response.body === 'object' ? Object.keys(response.body as object) : [],
    dataPreview
  });

  if (response.statusCode === 429) {
    context.logger.error('Rate limit exceeded', { method, endpoint });
    throw new NodeOperationError(
      context.getNode(),
      'Rate limit exceeded. Please try again later.'
    );
  }

  if (response.statusCode >= 400) {
    let bodyPreview = '';
    if (response.body !== null && response.body !== undefined) {
      try {
        const raw = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
        if (raw) {
          bodyPreview = ` (body: ${raw.substring(0, 200)})`;
        }
      } catch {
        // Ignore preview serialization failures
      }
    }
    context.logger.error('Buxfer API request failed', { statusCode: response.statusCode, method, endpoint });
    throw new NodeOperationError(
      context.getNode(),
      `Buxfer API request failed: HTTP ${response.statusCode}${bodyPreview}`
    );
  }

  debug('Request successful');
  return response.body;
}
