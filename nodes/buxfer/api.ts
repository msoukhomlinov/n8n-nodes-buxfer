import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { NodeOperationError, NodeApiError } from 'n8n-workflow';
import axios, { AxiosResponse } from 'axios';

// Debug flag - set to true to enable console logging
const DEBUG_ENABLED = true;

function debug(message: string, data?: any): void {
  if (DEBUG_ENABLED) {
    if (data !== undefined) {
      console.log(`[Buxfer Debug] ${message}`, data);
    } else {
      console.log(`[Buxfer Debug] ${message}`);
    }
  }
}

let tokenCache: string | null = null;
let tokenExpiry: number | null = null;

interface BuxferLoginResponse {
  response: {
    token: string;
  };
}

export async function buxferApiLogin(context: IExecuteFunctions | ILoadOptionsFunctions, email: string, password: string): Promise<string> {
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

    const response: AxiosResponse<BuxferLoginResponse> = await axios.post(
      'https://www.buxfer.com/api/login',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    debug('Login response', {
      status: response.status,
      dataKeys: Object.keys(response.data || {}),
      hasResponse: !!response.data?.response,
      hasToken: !!response.data?.response?.token
    });

    if (response.data?.response?.token) {
      tokenCache = response.data.response.token;
      tokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      debug('Login successful - token cached');
      return tokenCache;
    }

    debug('Login failed - invalid response structure', response.data);
    throw new NodeApiError(context.getNode(), { message: 'Login failed: Invalid response from Buxfer API' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.logger.error('Login failed', { message: errorMessage });
    throw new NodeApiError(
      context.getNode(),
      { message: `Login failed: ${errorMessage}` }
    );
  }
}

export async function getValidToken(context: IExecuteFunctions | ILoadOptionsFunctions): Promise<string> {
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
  context: IExecuteFunctions | ILoadOptionsFunctions,
  method: 'GET' | 'POST',
  endpoint: string,
  data?: any
): Promise<any> {
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

    const config: any = {
      method,
      url,
      headers: {},
    };

    if (method === 'GET') {
      // For GET requests, add token and data as query parameters
      const params = new URLSearchParams({ token });
      if (data) {
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }
      config.url += '?' + params.toString();
      debug('GET request URL', { finalUrl: config.url });
    } else if (method === 'POST') {
      // For POST requests, add token to query and data as form-encoded body
      config.url += '?token=' + encodeURIComponent(token);
      config.headers['Content-Type'] = 'application/x-www-form-urlencoded';

      if (data) {
        const params = new URLSearchParams();
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            // Special handling for JSON arrays (payers, sharers)
            if (typeof value === 'object' && !Array.isArray(value)) {
              params.append(key, JSON.stringify(value));
            } else {
              params.append(key, String(value));
            }
          }
        });
        config.data = params.toString();
        debug('POST request data', {
          dataLength: config.data.length,
          dataPreview: config.data.substring(0, 200) + (config.data.length > 200 ? '...' : '')
        });
      }
      debug('POST request URL', { finalUrl: config.url });
    }

    debug('Making API request...');
    const response: AxiosResponse = await axios(config);

    debug('API response', {
      status: response.status,
      statusText: response.statusText,
      dataKeys: Object.keys(response.data || {}),
      dataPreview: JSON.stringify(response.data, null, 2).substring(0, 500) + '...'
    });

    if (response.status === 401) {
      debug('Token expired, retrying with new token...');
      // Token expired, clear cache and retry once
      tokenCache = null;
      tokenExpiry = null;
      const newToken = await getValidToken(context);

      // Update the request with new token
      if (method === 'GET') {
        const params = new URLSearchParams({ token: newToken });
        if (data) {
          Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              params.append(key, String(value));
            }
          });
        }
        config.url = `https://www.buxfer.com/api${endpoint}?` + params.toString();
      } else {
        config.url = `https://www.buxfer.com/api${endpoint}?token=` + encodeURIComponent(newToken);
      }

      debug('Retry request URL', { retryUrl: config.url });
      const retryResponse = await axios(config);
      debug('Retry successful');
      return retryResponse.data;
    }

    debug('Request successful');
    return response.data;
  } catch (error) {
    if (error instanceof Error && 'response' in error && (error as any).response?.status === 429) {
      context.logger.error('Rate limit exceeded');
      throw new NodeOperationError(
        context.getNode(),
        'Rate limit exceeded. Please try again later.'
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.logger.error('Buxfer API request failed', { message: errorMessage });
    throw new NodeOperationError(
      context.getNode(),
      `Buxfer API request failed: ${errorMessage}`
    );
  }
}
