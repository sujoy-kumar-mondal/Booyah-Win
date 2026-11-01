/**
 * Important Updates API Client for Player PWA
 */

import { apiClient } from './client.js';
import type { ImportantUpdateDto } from '@booyah/shared';

export async function fetchImportantUpdates(): Promise<ImportantUpdateDto[]> {
  try {
    const res = await apiClient<any>('/api/v1/updates');
    return (res?.updates ?? res?.data?.updates ?? []) as ImportantUpdateDto[];
  } catch {
    // Return empty array on network/offline failure to allow cached/fallback slides
    return [];
  }
}
