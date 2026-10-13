import { apiClient } from './client.js';
import {
  staffUserListResponseGuard,
  staffUserDetailResponseGuard,
  statusResponseGuard,
  runGuard,
} from './guards.js';

export interface StaffUserListItem {
  id: string;
  name: string;
  email: string;
  mobile: string;
  ffId: string;
  ffName: string;
  upiId: string;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
}

export interface StaffUserProfileDto {
  id: string;
  name: string;
  email: string;
  mobile: string;
  ffId: string;
  ffName: string;
  upiId: string;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
}

export interface StaffUserLedgerItemDto {
  id: number;
  wallet: string;
  type: string;
  amount: string;
  balanceAfter: string;
  totalAfter: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
}

export interface StaffUserMatchItemDto {
  matchId: string;
  gameMode: string;
  teamMode: string;
  entryFee: string;
  startTime: string;
  matchStatus: string;
  kills: number;
  position: number | null;
  payout: string;
  displayStatus: string;
  joinedAt: string;
}

export interface StaffUserDepositItemDto {
  id: string;
  amount: string;
  utr: string;
  status: string;
  rejectReason: string | null;
  createdAt: string;
}

export interface StaffUserWithdrawalItemDto {
  id: string;
  amount: string;
  upiId: string;
  status: string;
  rejectReason: string | null;
  payoutRef: string | null;
  createdAt: string;
}

export interface StaffUserDetailDto {
  profile: StaffUserProfileDto;
  wallets: {
    addMoney: string;
    cashback: string;
    winning: string;
    total: string;
  };
  recentLedger: StaffUserLedgerItemDto[];
  matchHistory: StaffUserMatchItemDto[];
  depositHistory?: StaffUserDepositItemDto[];
  withdrawalHistory?: StaffUserWithdrawalItemDto[];
}

export async function getStaffUsers(
  q?: string,
  cursor?: string,
  limit = 20
): Promise<{ items: StaffUserListItem[]; nextCursor: string | null; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (q && q.trim()) params.append('q', q.trim());
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit.toString());

  const data = await apiClient.get<any>(`/staff/users?${params.toString()}`);
  return runGuard(staffUserListResponseGuard, data, 'GET /staff/users');
}

export async function getStaffUserDetail(userId: string): Promise<StaffUserDetailDto> {
  const data = await apiClient.get<any>(`/staff/users/${userId}`);
  return runGuard(staffUserDetailResponseGuard, data, `GET /staff/users/${userId}`);
}

export async function getSystemStatus(): Promise<{
  maintenance: {
    enabled: boolean;
    message: string;
    until: string | null;
    unknown?: boolean;
  };
  retryAfter?: number;
} | null> {
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

    if (!res.ok) return null;
    const json = await res.json();
    return runGuard(statusResponseGuard, json.data, 'GET /status');
  } catch {
    return null;
  }
}
