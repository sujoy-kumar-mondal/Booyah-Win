/**
 * Admin API service functions for Booyah Win Staff Portal
 */

import { apiClient } from './client.js';
import {
  runGuard,
  employeeListResponseGuard,
  employeeSingleResponseGuard,
  employeeDeleteResponseGuard,
  entryTiersResponseGuard,
  createTierResponseGuard,
  updateTierResponseGuard,
  deleteTierResponseGuard,
  adminUserListResponseGuard,
  adminUserDetailResponseGuard,
  adminUserDeleteResponseGuard,
  adminUserAdjustResponseGuard,
  adminSettingsResponseGuard,
  adminUploadPaymentQrResponseGuard,
  adminAuditLogsResponseGuard,
  adminAuditLogDetailResponseGuard,
} from './guards.js';
import type { z } from 'zod';
import type {
  employeeDtoGuard,
  entryTierGuard,
  adminUserListItemGuard,
  adminUserDetailProfileGuard,
  adminUserLedgerItemGuard,
  adminUserMatchHistoryItemGuard,
  adminAuditLogItemGuard,
  adminAuditLogDetailGuard,
} from './guards.js';

export type EmployeeDto = z.infer<typeof employeeDtoGuard>;
export type EntryTierDto = z.infer<typeof entryTierGuard>;
export type AdminUserListItem = z.infer<typeof adminUserListItemGuard>;
export type AdminUserProfileDto = z.infer<typeof adminUserDetailProfileGuard>;
export type AdminUserLedgerItemDto = z.infer<typeof adminUserLedgerItemGuard>;
export type AdminUserMatchHistoryItemDto = z.infer<typeof adminUserMatchHistoryItemGuard>;
export type AdminAuditLogItemDto = z.infer<typeof adminAuditLogItemGuard>;
export type AdminAuditLogDetailDto = z.infer<typeof adminAuditLogDetailGuard>;

// ─── 1. Employee Management ───────────────────────────────────────────────────

export interface CreateEmployeeInput {
  name: string;
  mobile: string;
  email: string;
  pan?: string;
  aadhaar?: string;
}

export interface UpdateEmployeeInput {
  name?: string;
  mobile?: string;
  email?: string;
  pan?: string;
  aadhaar?: string;
}

export async function getAdminEmployees(params?: {
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: EmployeeDto[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);

  const qs = query.toString();
  const endpoint = qs ? `/admin/employees?${qs}` : '/admin/employees';
  const data = await apiClient.get<any>(endpoint);
  return runGuard(employeeListResponseGuard, data, 'GET /admin/employees');
}

export async function createAdminEmployee(
  payload: CreateEmployeeInput
): Promise<{ employee: EmployeeDto }> {
  const data = await apiClient.post<any>('/admin/employees', payload);
  return runGuard(employeeSingleResponseGuard, data, 'POST /admin/employees');
}

export async function updateAdminEmployee(
  id: string,
  payload: UpdateEmployeeInput
): Promise<{ employee: EmployeeDto }> {
  const data = await apiClient.patch<any>(`/admin/employees/${id}`, payload);
  return runGuard(employeeSingleResponseGuard, data, 'PATCH /admin/employees/:id');
}

export async function deleteAdminEmployee(
  id: string
): Promise<{ message: string }> {
  const data = await apiClient.delete<any>(`/admin/employees/${id}`);
  return runGuard(employeeDeleteResponseGuard, data, 'DELETE /admin/employees/:id');
}

// ─── 2. Entry Tier Management ─────────────────────────────────────────────────

export interface CreateTierInput {
  gameMode: 'battle_royale' | 'clash_squad' | 'lone_wolf';
  teamMode: 'solo' | 'duo' | 'squad';
  entryFee: string;
  killPrice?: string;
  minKillsForReward?: number;
  maxPlayers?: number;
  minPlayers?: number;
  positions: Array<{ position: number; prize: string }>;
}

export async function getAdminTiers(): Promise<{ tiers: EntryTierDto[] }> {
  const data = await apiClient.get<any>('/admin/tiers');
  return runGuard(entryTiersResponseGuard, data, 'GET /admin/tiers');
}

export async function createAdminTier(
  payload: CreateTierInput
): Promise<{ tier: EntryTierDto; warning?: string | null }> {
  const data = await apiClient.post<any>('/admin/tiers', payload);
  return runGuard(createTierResponseGuard, data, 'POST /admin/tiers');
}

export async function updateAdminTier(
  id: string,
  payload: Partial<CreateTierInput>
): Promise<{ tier: EntryTierDto; warning?: string | null }> {
  const data = await apiClient.patch<any>(`/admin/tiers/${id}`, payload);
  return runGuard(updateTierResponseGuard, data, 'PATCH /admin/tiers/:id');
}

export async function deleteAdminTier(
  id: string
): Promise<{ message: string }> {
  const data = await apiClient.delete<any>(`/admin/tiers/${id}`);
  return runGuard(deleteTierResponseGuard, data, 'DELETE /admin/tiers/:id');
}

// ─── 3. User Management ───────────────────────────────────────────────────────

export async function getAdminUsers(params?: {
  q?: string;
  limit?: number;
  cursor?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<{ items: AdminUserListItem[]; nextCursor: string | null; hasMore: boolean }> {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);
  if (params?.fromDate) query.set('fromDate', params.fromDate);
  if (params?.toDate) query.set('toDate', params.toDate);

  const qs = query.toString();
  const endpoint = qs ? `/admin/users?${qs}` : '/admin/users';
  const data = await apiClient.get<any>(endpoint);
  return runGuard(adminUserListResponseGuard, data, 'GET /admin/users');
}

export async function getAdminUserDetail(
  id: string
): Promise<z.infer<typeof adminUserDetailResponseGuard>> {
  const data = await apiClient.get<any>(`/admin/users/${id}`);
  return runGuard(adminUserDetailResponseGuard, data, 'GET /admin/users/:id');
}

export async function deleteAdminUser(
  id: string,
  reason: string
): Promise<{ id: string; message: string }> {
  const data = await apiClient.delete<any>(`/admin/users/${id}`, {
    body: JSON.stringify({ reason }),
    headers: { 'Content-Type': 'application/json' },
  });
  return runGuard(adminUserDeleteResponseGuard, data, 'DELETE /admin/users/:id');
}

export async function adjustUserBalance(
  id: string,
  payload: {
    wallet: 'add_money' | 'cashback' | 'winning';
    amount: string;
    reason: string;
  }
): Promise<{
  userId: string;
  wallet: 'add_money' | 'cashback' | 'winning';
  amount: string;
  balances: { addMoney: string; cashback: string; winning: string; total: string };
}> {
  const data = await apiClient.post<any>(`/admin/users/${id}/adjust`, payload);
  return runGuard(adminUserAdjustResponseGuard, data, 'POST /admin/users/:id/adjust');
}

// ─── 4. Platform Settings ─────────────────────────────────────────────────────

export async function getAdminSettings(): Promise<{ settings: Record<string, string> }> {
  const data = await apiClient.get<any>('/admin/settings');
  return runGuard(adminSettingsResponseGuard, data, 'GET /admin/settings');
}

export async function updateAdminSettings(
  updates: Record<string, string>
): Promise<{ settings: Record<string, string> }> {
  const data = await apiClient.patch<any>('/admin/settings', updates);
  return runGuard(adminSettingsResponseGuard, data, 'PATCH /admin/settings');
}

export async function uploadPaymentQr(
  file: File | Blob
): Promise<{ paymentQrKey: string; qrUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const data = await apiClient.post<any>('/admin/settings/payment-qr', formData);
  return runGuard(adminUploadPaymentQrResponseGuard, data, 'POST /admin/settings/payment-qr');
}

export async function uploadMatchBanner(
  file: File | Blob,
  gameMode?: string
): Promise<{ matchRulesImageKey: string; matchRulesImageUrl: string }> {
  const formData = new FormData();
  formData.append('banner', file);
  const q = gameMode ? `gameMode=${encodeURIComponent(gameMode)}` : '';
  const res = await apiClient.post<any>(`/admin/settings/match-banner?${q}`, formData);
  return res?.data ?? res;
}

export async function deleteMatchBanner(
  gameMode?: string
): Promise<{ success: boolean; matchRulesImageUrl: string }> {
  const q = gameMode ? `gameMode=${encodeURIComponent(gameMode)}` : '';
  const res = await apiClient.delete<any>(`/admin/settings/match-banner?${q}`);
  return res?.data ?? res;
}

// ─── 5. Audit Logs ────────────────────────────────────────────────────────────

export async function getAdminAuditLogs(params?: {
  staffId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: AdminAuditLogItemDto[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (params?.staffId) query.set('staffId', params.staffId);
  if (params?.action) query.set('action', params.action);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);

  const qs = query.toString();
  const endpoint = qs ? `/admin/audit-logs?${qs}` : '/admin/audit-logs';
  const data = await apiClient.get<any>(endpoint);
  return runGuard(adminAuditLogsResponseGuard, data, 'GET /admin/audit-logs');
}

export async function getAdminAuditLog(id: string): Promise<{ log: AdminAuditLogDetailDto }> {
  const data = await apiClient.get<any>(`/admin/audit-logs/${encodeURIComponent(id)}`);
  return runGuard(adminAuditLogDetailResponseGuard, data, 'GET /admin/audit-logs/:id');
}

// ─── 6. Banners Management ───────────────────────────────────────────────────

export interface BannerDto {
  id: string;
  title: string | null;
  imageUrl: string;
  imageKey?: string;
  targetUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getAdminBanners(): Promise<BannerDto[]> {
  const res = await apiClient.get<any>('/admin/banners');
  return (res?.banners ?? res?.data?.banners ?? []) as BannerDto[];
}

export async function createAdminBanner(formData: FormData): Promise<BannerDto> {
  const res = await apiClient.post<any>('/admin/banners', formData);
  return (res?.banner ?? res?.data?.banner) as BannerDto;
}

export async function updateAdminBanner(id: string, formData: FormData): Promise<BannerDto> {
  const res = await apiClient.patch<any>(`/admin/banners/${id}`, formData);
  return (res?.banner ?? res?.data?.banner) as BannerDto;
}

export async function deleteAdminBanner(id: string): Promise<void> {
  await apiClient.delete(`/admin/banners/${id}`);
}

// ─── 7. Important Updates Management ─────────────────────────────────────────

export interface UpdatePointDto {
  label: string;
  text: string;
}

export interface ImportantUpdateDto {
  id: string;
  title: string;
  category: string;
  dateDisplay: string;
  heading: string;
  summary?: string | null;
  points: UpdatePointDto[];
  notice?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUpdateInput {
  title: string;
  category?: string;
  dateDisplay: string;
  heading: string;
  summary?: string;
  points: UpdatePointDto[];
  notice?: string;
  linkUrl?: string;
  linkText?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateUpdateInput {
  title?: string;
  category?: string;
  dateDisplay?: string;
  heading?: string;
  summary?: string;
  points?: UpdatePointDto[];
  notice?: string;
  linkUrl?: string;
  linkText?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function getAdminUpdates(): Promise<ImportantUpdateDto[]> {
  const res = await apiClient.get<any>('/admin/updates');
  return (res?.updates ?? res?.data?.updates ?? []) as ImportantUpdateDto[];
}

export async function createAdminUpdate(input: CreateUpdateInput): Promise<ImportantUpdateDto> {
  const res = await apiClient.post<any>('/admin/updates', input);
  return (res?.update ?? res?.data?.update) as ImportantUpdateDto;
}

export async function updateAdminUpdate(
  id: string,
  input: UpdateUpdateInput
): Promise<ImportantUpdateDto> {
  const res = await apiClient.patch<any>(`/admin/updates/${id}`, input);
  return (res?.update ?? res?.data?.update) as ImportantUpdateDto;
}

export async function deleteAdminUpdate(id: string): Promise<void> {
  await apiClient.delete(`/admin/updates/${id}`);
}

// ─── 8. Admin Notifications Management ───────────────────────────────────────

export interface AdminNotificationItem {
  id: string;
  userId: string | null;
  targetUsername: string | null;
  targetName: string | null;
  isBroadcast: boolean;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  metadata?: any;
  createdAt: string;
}

export interface CreateAdminNotificationInput {
  title: string;
  message: string;
  type?: string;
  target?: 'all' | 'specific';
  targetUserId?: string | number;
  targetUsername?: string;
  actionUrl?: string;
}

export async function getAdminNotifications(): Promise<{ items: AdminNotificationItem[]; total: number }> {
  const res = await apiClient.get<any>('/admin/notifications');
  return (res?.data ?? res) as { items: AdminNotificationItem[]; total: number };
}

export async function createAdminNotification(input: CreateAdminNotificationInput): Promise<AdminNotificationItem> {
  const res = await apiClient.post<any>('/admin/notifications', input);
  return (res?.data ?? res) as AdminNotificationItem;
}

export async function deleteAdminNotification(id: string): Promise<void> {
  await apiClient.delete(`/admin/notifications/${id}`);
}


