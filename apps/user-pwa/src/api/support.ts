import { apiClient } from './client.js';
import { runGuard, userSupportInfoResponseGuard } from './guards.js';
import type { z } from 'zod';

export type SupportInfo = z.infer<typeof userSupportInfoResponseGuard>;

export async function fetchSupportInfo(): Promise<SupportInfo> {
  const data = await apiClient<any>('/api/v1/support');
  return runGuard(userSupportInfoResponseGuard, data, 'GET /api/v1/support');
}
