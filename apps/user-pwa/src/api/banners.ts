/**
 * Banners API client for Player PWA
 */

import { apiClient } from './client.js';
import { BannerDto } from '@booyah/shared';

export interface BannersResponse {
  banners: BannerDto[];
}

export async function fetchActiveBanners(): Promise<BannerDto[]> {
  try {
    const res = await apiClient<any>('/api/v1/banners');
    return (res?.banners ?? res?.data?.banners ?? []) as BannerDto[];
  } catch {
    // On network failure or offline, return empty array to allow fallback slides
    return [];
  }
}
