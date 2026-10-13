import { getUserFriendlyErrorMessage } from './errorMessages.js';
import { ErrorCodes } from '@booyah/shared';

export class ApiError extends Error {
  code: string;
  details: Record<string, any>;
  status: number;

  constructor(code: string, message: string, details: Record<string, any> = {}, status = 400) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

// Token storage key
const TOKEN_KEY = 'booyah_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

// Global Event Listeners for Session & Network status
type VoidCallback = () => void;
type SlowCallback = (isSlow: boolean) => void;

const sessionReplacedListeners = new Set<VoidCallback>();
const unauthenticatedListeners = new Set<VoidCallback>();
const slowRequestListeners = new Set<SlowCallback>();
const maintenanceModeListeners = new Set<(msg?: string) => void>();

export function onSessionReplaced(cb: VoidCallback): () => void {
  sessionReplacedListeners.add(cb);
  return () => sessionReplacedListeners.delete(cb);
}

export function onUnauthenticated(cb: VoidCallback): () => void {
  unauthenticatedListeners.add(cb);
  return () => unauthenticatedListeners.delete(cb);
}

export function onSlowRequest(cb: SlowCallback): () => void {
  slowRequestListeners.add(cb);
  return () => slowRequestListeners.delete(cb);
}

export function onMaintenanceMode(cb: (msg?: string) => void): () => void {
  maintenanceModeListeners.add(cb);
  return () => maintenanceModeListeners.delete(cb);
}

function notifySessionReplaced(): void {
  sessionReplacedListeners.forEach((cb) => cb());
}

function notifyUnauthenticated(): void {
  unauthenticatedListeners.forEach((cb) => cb());
}

function notifyMaintenanceMode(msg?: string): void {
  maintenanceModeListeners.forEach((cb) => cb(msg));
}

let activeSlowCount = 0;
function notifySlow(isSlow: boolean): void {
  if (isSlow) {
    activeSlowCount++;
    if (activeSlowCount === 1) {
      slowRequestListeners.forEach((cb) => cb(true));
    }
  } else {
    activeSlowCount = Math.max(0, activeSlowCount - 1);
    if (activeSlowCount === 0) {
      slowRequestListeners.forEach((cb) => cb(false));
    }
  }
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 45000, headers = {}, ...restOptions } = options;

  // Resolve base URL: VITE_API_URL takes precedence
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
  const url = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}` : endpoint;

  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
  const reqHeaders: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string>),
  };

  const token = getStoredToken();
  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // 5-second slow server trigger ("Waking up the server, this can take up to a minute")
  let wasMarkedSlow = false;
  const slowTimer = setTimeout(() => {
    wasMarkedSlow = true;
    notifySlow(true);
  }, 5000);

  try {
    const res = await fetch(url, {
      ...restOptions,
      headers: reqHeaders,
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    let json: any = null;

    if (contentType.includes('application/json')) {
      try {
        json = await res.json();
      } catch {
        json = null;
      }
    }

    // Non-JSON responses (e.g. HTML 502/503 from proxy or sleeping Render instance)
    if (!json) {
      throw new ApiError(
        'NON_JSON_RESPONSE',
        getUserFriendlyErrorMessage('NON_JSON_RESPONSE'),
        {},
        res.status || 503
      );
    }

    // Handle API Error Envelope
    if (!res.ok || json.error) {
      const code = json.error?.code || 'INTERNAL_ERROR';
      const friendlyMessage = getUserFriendlyErrorMessage(code);
      const details = json.error?.details || {};

      if (code === ErrorCodes.SESSION_REPLACED) {
        clearStoredToken();
        notifySessionReplaced();
      } else if (code === ErrorCodes.UNAUTHENTICATED) {
        clearStoredToken();
        notifyUnauthenticated();
      } else if (code === ErrorCodes.MAINTENANCE_MODE || res.status === 503) {
        notifyMaintenanceMode(json.error?.message);
      }

      throw new ApiError(code, friendlyMessage, details, res.status);
    }

    // Success: unwrap { data }
    return (json.data !== undefined ? json.data : json) as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }

    if (timedOut || err.name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'Server request timed out. Please try again.', {}, 408);
    }

    // Generic network connection error (never expose raw internal error)
    throw new ApiError(
      'NETWORK_ERROR',
      getUserFriendlyErrorMessage('NETWORK_ERROR'),
      {},
      0
    );
  } finally {
    clearTimeout(timeoutId);
    clearTimeout(slowTimer);
    if (wasMarkedSlow) {
      notifySlow(false);
    }
  }
}
