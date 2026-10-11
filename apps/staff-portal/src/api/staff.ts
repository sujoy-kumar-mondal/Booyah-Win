/**
 * Staff Portal API service functions
 */

import { apiClient } from './client.js';
import {
  runGuard,
  staffMeGuard,
  staffLoginResponseGuard,
  dashboardMetricsGuard,
  depositListResponseGuard,
  withdrawalListResponseGuard,
} from './guards.js';
import type {
  StaffLoginOtpRequestResponse,
  StaffLoginOtpVerifyResponse,
  StaffMeResponse,
  DashboardMetricsDto,
  DepositListResponse,
  WithdrawalListResponse,
  GenericMessageResponse,
} from './types.js';

export async function requestStaffOtp(email: string): Promise<StaffLoginOtpRequestResponse> {
  return apiClient.post<StaffLoginOtpRequestResponse>(
    '/staff/auth/login/request-otp',
    { email },
    { skipAuth: true }
  );
}

export async function verifyStaffOtp(
  email: string,
  otp: string
): Promise<StaffLoginOtpVerifyResponse> {
  const data = await apiClient.post<StaffLoginOtpVerifyResponse>(
    '/staff/auth/login/verify-otp',
    { email, otp },
    { skipAuth: true }
  );
  return runGuard(staffLoginResponseGuard, data, 'POST /staff/auth/login/verify-otp');
}

export async function logoutStaff(): Promise<GenericMessageResponse> {
  return apiClient.post<GenericMessageResponse>('/staff/auth/logout');
}

export async function getStaffMe(): Promise<StaffMeResponse> {
  const data = await apiClient.get<StaffMeResponse>('/staff/me');
  return runGuard(staffMeGuard, data, 'GET /staff/me');
}

export async function getStaffDashboard(): Promise<DashboardMetricsDto> {
  const data = await apiClient.get<DashboardMetricsDto>('/staff/dashboard');
  return runGuard(dashboardMetricsGuard, data, 'GET /staff/dashboard');
}

export async function getStaffDeposits(params?: {
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<DepositListResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'all') {
    query.set('status', params.status);
  }
  if (params?.limit) {
    query.set('limit', String(params.limit));
  }
  if (params?.cursor) {
    query.set('cursor', params.cursor);
  }

  const qs = query.toString();
  const endpoint = qs ? `/staff/deposits?${qs}` : '/staff/deposits';
  const data = await apiClient.get<DepositListResponse>(endpoint);
  return runGuard(depositListResponseGuard, data, 'GET /staff/deposits');
}

export async function approveDeposit(depositId: string): Promise<GenericMessageResponse> {
  return apiClient.post<GenericMessageResponse>(`/staff/deposits/${depositId}/approve`);
}

export async function rejectDeposit(
  depositId: string,
  reason: string
): Promise<GenericMessageResponse> {
  return apiClient.post<GenericMessageResponse>(`/staff/deposits/${depositId}/reject`, {
    reason,
  });
}

export async function getStaffWithdrawals(params?: {
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<WithdrawalListResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'all') {
    query.set('status', params.status);
  }
  if (params?.limit) {
    query.set('limit', String(params.limit));
  }
  if (params?.cursor) {
    query.set('cursor', params.cursor);
  }

  const qs = query.toString();
  const endpoint = qs ? `/staff/withdrawals?${qs}` : '/staff/withdrawals';
  const data = await apiClient.get<WithdrawalListResponse>(endpoint);
  return runGuard(withdrawalListResponseGuard, data, 'GET /staff/withdrawals');
}

export async function markWithdrawalPaid(
  withdrawalId: string,
  payoutRef: string
): Promise<GenericMessageResponse> {
  return apiClient.post<GenericMessageResponse>(
    `/staff/withdrawals/${withdrawalId}/mark-paid`,
    { payoutRef }
  );
}

export async function rejectWithdrawal(
  withdrawalId: string,
  reason: string
): Promise<GenericMessageResponse> {
  return apiClient.post<GenericMessageResponse>(
    `/staff/withdrawals/${withdrawalId}/reject`,
    { reason }
  );
}
