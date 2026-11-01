/**
 * Notifications API Client for Player PWA
 */

import { apiClient } from './client.js';
import type { NotificationItemDto } from '@booyah/shared';

let inFlightFetch: Promise<NotificationItemDto[]> | null = null;
let lastFetchTime = 0;
let lastCachedResult: NotificationItemDto[] = [];

export async function fetchUserNotifications(): Promise<NotificationItemDto[]> {
  const now = Date.now();
  if (inFlightFetch) {
    return inFlightFetch;
  }
  if (lastCachedResult.length > 0 && now - lastFetchTime < 3000) {
    return lastCachedResult;
  }

  inFlightFetch = (async () => {
    try {
      const res = await apiClient<any>('/api/v1/me/notifications');
      const data = ((res?.data ?? res) as NotificationItemDto[]) || [];
      lastCachedResult = data;
      lastFetchTime = Date.now();
      return data;
    } catch {
      return [];
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}
