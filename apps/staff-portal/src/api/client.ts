/**
 * API client for Booyah Win Staff Portal
 *
 * Requirements:
 * - Requirement 2: Store staff token in sessionStorage with single constant key, never log it
 * - Requirement 11: Never log UPI IDs, tokens, or screenshot URLs
 */

export const STAFF_TOKEN_STORAGE_KEY = 'booyah_staff_token';

export function getStoredStaffToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      localStorage.getItem(STAFF_TOKEN_STORAGE_KEY) ||
      sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function isRememberedStaffToken(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!localStorage.getItem(STAFF_TOKEN_STORAGE_KEY);
  } catch {
    return false;
  }
}

export function setStoredStaffToken(token: string, remember: boolean = true): void {
  if (typeof window === 'undefined') return;
  try {
    if (remember) {
      localStorage.setItem(STAFF_TOKEN_STORAGE_KEY, token);
      sessionStorage.removeItem(STAFF_TOKEN_STORAGE_KEY);
    } else {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, token);
      localStorage.removeItem(STAFF_TOKEN_STORAGE_KEY);
    }
  } catch {
    // storage unavailable or quota exceeded
  }
}

export function clearStoredStaffToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STAFF_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(STAFF_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

type ReauthHandler = () => Promise<boolean>;
let activeReauthHandler: ReauthHandler | null = null;
let reauthPromise: Promise<boolean> | null = null;

export function registerReauthHandler(handler: ReauthHandler | null): void {
  activeReauthHandler = handler;
}

export function promptStepUpElevation(): Promise<boolean> {
  if (!activeReauthHandler) {
    return Promise.resolve(false);
  }
  if (!reauthPromise) {
    reauthPromise = activeReauthHandler().finally(() => {
      reauthPromise = null;
    });
  }
  return reauthPromise;
}

export class ApiError extends Error {
  code: string;
  details: Record<string, any>;
  status: number;

  constructor(
    codeOrStatus: string | number,
    messageOrCode: string,
    detailsOrMessage: any = {},
    statusOrDetails: any = 400
  ) {
    if (typeof codeOrStatus === 'number') {
      // constructor(status, code, message, details)
      const status = codeOrStatus;
      const code = messageOrCode;
      const message = typeof detailsOrMessage === 'string' ? detailsOrMessage : 'ApiError';
      const details = typeof statusOrDetails === 'object' ? statusOrDetails : {};
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.details = details;
    } else {
      // constructor(code, message, details, status)
      const code = codeOrStatus;
      const message = messageOrCode;
      const details = typeof detailsOrMessage === 'object' ? detailsOrMessage : {};
      const status = typeof statusOrDetails === 'number' ? statusOrDetails : 400;
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.details = details;
      this.status = status;
    }
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

export function getApiBaseUrl(customEnvUrl?: string): string {
  const rawUrl = customEnvUrl !== undefined ? customEnvUrl : importMetaEnv('VITE_API_URL');
  const envUrl = (rawUrl || '').trim();
  if (!envUrl) {
    return '/api/v1';
  }
  // Strip any trailing slashes
  const cleanUrl = envUrl.replace(/\/+$/, '');
  if (cleanUrl.endsWith('/api/v1')) {
    return cleanUrl;
  }
  return `${cleanUrl}/api/v1`;
}

function importMetaEnv(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as Record<string, string | undefined>)[key];
  }
  return undefined;
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
  _isRetry?: boolean;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/v1/')) {
    cleanEndpoint = cleanEndpoint.replace(/^\/api\/v1/, '');
  }
  const url = `${baseUrl}${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});

  // Add JSON content type unless body is FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject Bearer token if not skipped
  if (!options.skipAuth) {
    const token = getStoredStaffToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse JSON safely
    let responseData: any = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
    } else {
      await response.text().catch(() => '');
      throw new ApiError(
        'NON_JSON_RESPONSE',
        'The server sent an unexpected response.',
        {},
        response.status
      );
    }

    if (!responseData) {
      throw new ApiError(
        'NON_JSON_RESPONSE',
        'The server sent an unexpected response.',
        {},
        response.status
      );
    }

    if (!response.ok) {
      const err = responseData?.error;
      const code = err?.code || (response.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL_ERROR');
      const message = err?.message || 'An unexpected error occurred';
      const details = err?.details || {};

      if (code === 'REAUTH_REQUIRED' && !options._isRetry) {
        const elevated = await promptStepUpElevation();
        if (elevated) {
          return request<T>(endpoint, { ...options, _isRetry: true });
        }
      }

      throw new ApiError(code, message, details, response.status);
    }

    // Return the unwrapped data payload
    return responseData?.data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    if (err.name === 'AbortError') {
      throw new ApiError('TIMEOUT_ERROR', 'Request timed out. Please try again.', {}, 408);
    }

    throw new ApiError(
      'NETWORK_ERROR',
      'Cannot reach the server. Check that the API is running.',
      {},
      0
    );
  }
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
