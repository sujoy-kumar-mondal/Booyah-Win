import { statusResponseGuard, runGuard } from './guards.js';

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  until: string | null;
  unknown?: boolean;
}

export interface StatusResult {
  maintenance: MaintenanceStatus;
  retryAfter?: number;
}

export async function getSystemStatus(): Promise<StatusResult | null> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  try {
    const res = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.status === 429) {
      const retryHeader = res.headers.get('Retry-After');
      const retryAfter = retryHeader ? parseInt(retryHeader, 10) : 60;
      return {
        maintenance: {
          enabled: false,
          message: '',
          until: null,
          unknown: true,
        },
        retryAfter: isNaN(retryAfter) ? 60 : retryAfter,
      };
    }

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    const data = json.data;
    const guarded = runGuard(statusResponseGuard, data, 'GET /status');
    return guarded;
  } catch {
    return null;
  }
}
