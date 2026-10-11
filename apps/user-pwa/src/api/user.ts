import { apiClient } from './client.js';
import { runGuard, getMeGuard } from './guards.js';
import type { GetMeData, UpdateProfilePayload } from './types.js';

export async function getMe(): Promise<GetMeData> {
  const data = await apiClient<GetMeData>('/api/v1/me');
  return runGuard(getMeGuard, data, 'GET /api/v1/me');
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<GetMeData> {
  const data = await apiClient<GetMeData>('/api/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return runGuard(getMeGuard, data, 'PATCH /api/v1/me/profile');
}
