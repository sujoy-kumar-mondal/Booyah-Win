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

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  return apiClient<{ avatarUrl: string }>('/api/v1/me/avatar', {
    method: 'POST',
    body: formData,
    timeoutMs: 30000,
  });
}

export async function deleteAvatar(): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>('/api/v1/me/avatar', {
    method: 'DELETE',
  });
}

export async function updateUserLanguage(language: 'en' | 'bn'): Promise<{ language: 'en' | 'bn' }> {
  return apiClient<{ language: 'en' | 'bn' }>('/api/v1/me/language', {
    method: 'PATCH',
    body: JSON.stringify({ language }),
  });
}
