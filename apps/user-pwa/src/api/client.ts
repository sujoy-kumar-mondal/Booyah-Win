import { getUserFriendlyErrorMessage } from './errorMessages.js';
import { ErrorCodes } from '@booyah/shared';
import { Capacitor } from '@capacitor/core';
import { isIPhone } from '../utils/deviceDetection.js';

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

let isMaintenanceModeActive = false;

export function setMaintenanceModeActive(active: boolean): void {
  isMaintenanceModeActive = active;
}

export function isMaintenanceActive(): boolean {
  return isMaintenanceModeActive;
}

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
  isMaintenanceModeActive = true;
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
  skipAuthEvents?: boolean;
}

/**
 * Returns the environment-appropriate API base URL.
 * Automatically adapts between Web browser (localhost) and Android native emulator (10.0.2.2)
 * so development works seamlessly on both platforms without manual configuration changes.
 */
export function getApiBaseUrl(): string {
  let rawBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  if (isNative) {
    // If native on Android, and base URL points to localhost or 127.0.0.1,
    // map it to 10.0.2.2 so the emulator can reach the host machine without adb reverse.
    if (Capacitor.getPlatform() === 'android') {
      if (rawBase.includes('localhost')) {
        rawBase = rawBase.replace('localhost', '10.0.2.2');
      } else if (rawBase.includes('127.0.0.1')) {
        rawBase = rawBase.replace('127.0.0.1', '10.0.2.2');
      }
    }
  } else {
    // Running in a web browser (desktop, mobile web, or PWA):
    // 10.0.2.2 is an Android emulator internal IP that will always fail in web browsers.
    // Map 10.0.2.2 back to localhost so web browsers connect successfully.
    if (rawBase.includes('10.0.2.2')) {
      rawBase = rawBase.replace('10.0.2.2', 'localhost');
    }
  }

  return rawBase;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 45000, headers = {}, ...restOptions } = options;

  // 1. Maintenance Mode API Guard: block all APIs except status and health checks
  if (isMaintenanceActive() && !endpoint.includes('status') && !endpoint.includes('health')) {
    throw new ApiError(
      ErrorCodes.MAINTENANCE_MODE,
      'System is currently undergoing maintenance. All tournament and wallet actions are paused.',
      {},
      503
    );
  }

  // Resolve base URL: VITE_API_URL takes precedence with platform adaptation
  const rawBase = getApiBaseUrl();
  const trimmed = endpoint.replace(/^\/+/, '');
  let url = endpoint;
  if (rawBase) {
    const cleanBase = rawBase.replace(/\/+$/, '');
    if (cleanBase.endsWith('/api') && trimmed.startsWith('api/')) {
      url = cleanBase + '/' + trimmed.slice(4);
    } else {
      url = cleanBase + '/' + trimmed;
    }
  }

  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
  const reqHeaders: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string>),
  };

  // Identify client platform to the backend API
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    reqHeaders['X-Booyah-Client'] = 'android-app';
  } else if (isIPhone()) {
    reqHeaders['X-Booyah-Client'] = 'iphone-web';
  } else {
    reqHeaders['X-Booyah-Client'] = 'disallowed-web';
  }

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

    let json: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        json = await res.json();
      } catch {
        json = null;
      }
    }

    // Safety: If response is HTML or non-JSON, never throw raw text/HTML to user
    if (!json) {
      if (res.status === 503) {
        notifyMaintenanceMode();
        throw new ApiError(
          ErrorCodes.MAINTENANCE_MODE,
          getUserFriendlyErrorMessage(ErrorCodes.MAINTENANCE_MODE),
          {},
          503
        );
      }
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

      if (code === ErrorCodes.SESSION_REPLACED && !options.skipAuthEvents) {
        clearStoredToken();
        notifySessionReplaced();
      } else if (code === ErrorCodes.UNAUTHENTICATED && !options.skipAuthEvents) {
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
