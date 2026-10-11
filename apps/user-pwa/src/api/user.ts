import { apiClient } from './client.js';
import type { GetMeData, UpdateProfilePayload } from './types.js';

export async function getMe(): Promise<GetMeData> {
  return apiClient<GetMeData>('/api/v1/me');
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<GetMeData> {
  return apiClient<GetMeData>('/api/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
