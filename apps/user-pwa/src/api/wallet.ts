import { apiClient } from './client.js';
import {
  runGuard,
  paymentInfoDtoGuard,
  depositDtoGuard,
  depositListResponseGuard,
  withdrawalDtoGuard,
  withdrawalListResponseGuard,
  transactionListResponseGuard,
} from './guards.js';
import type {
  PaymentInfoDto,
  DepositDto,
  DepositListResponse,
  WithdrawalDto,
  WithdrawalListResponse,
  TransactionListResponse,
} from './types.js';

/**
 * Fetch public payment configuration (merchant UPI, signed QR URL, limits).
 */
export async function getPaymentInfo(): Promise<PaymentInfoDto> {
  const data = await apiClient<PaymentInfoDto>('/api/v1/payment-info');
  return runGuard(paymentInfoDtoGuard, data, 'GET /api/v1/payment-info');
}

/**
 * Submit manual deposit request with screenshot.
 * Requirement 5: Uses a 60-second timeout.
 */
export async function createDeposit(formData: FormData): Promise<DepositDto> {
  const data = await apiClient<DepositDto>('/api/v1/wallet/deposits', {
    method: 'POST',
    body: formData,
    timeoutMs: 60000,
  });
  return runGuard(depositDtoGuard, data, 'POST /api/v1/wallet/deposits');
}

/**
 * List own deposit requests with cursor pagination.
 */
export async function getDeposits(cursor?: string, limit = 20): Promise<DepositListResponse> {
  const query = new URLSearchParams();
  if (cursor) query.set('cursor', cursor);
  if (limit) query.set('limit', limit.toString());
  const qs = query.toString();
  const data = await apiClient<DepositListResponse>(`/api/v1/wallet/deposits${qs ? `?${qs}` : ''}`);
  return runGuard(depositListResponseGuard, data, 'GET /api/v1/wallet/deposits');
}

/**
 * Request a withdrawal from winning balance.
 * Requirement 5: Uses a 60-second timeout.
 */
export async function createWithdrawal(payload: {
  amount: string;
  upiId: string;
  confirm: boolean;
}): Promise<WithdrawalDto> {
  const data = await apiClient<WithdrawalDto>('/api/v1/wallet/withdrawals', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  });
  return runGuard(withdrawalDtoGuard, data, 'POST /api/v1/wallet/withdrawals');
}

/**
 * List own withdrawal requests with cursor pagination.
 */
export async function getWithdrawals(cursor?: string, limit = 20): Promise<WithdrawalListResponse> {
  const query = new URLSearchParams();
  if (cursor) query.set('cursor', cursor);
  if (limit) query.set('limit', limit.toString());
  const qs = query.toString();
  const data = await apiClient<WithdrawalListResponse>(`/api/v1/wallet/withdrawals${qs ? `?${qs}` : ''}`);
  return runGuard(withdrawalListResponseGuard, data, 'GET /api/v1/wallet/withdrawals');
}

/**
 * List transaction history with optional type filter and cursor pagination.
 */
export async function getTransactions(params?: {
  type?: string;
  cursor?: string;
  limit?: number;
}): Promise<TransactionListResponse> {
  const query = new URLSearchParams();
  if (params?.type && params.type !== 'all') {
    query.set('type', params.type);
  }
  if (params?.cursor) query.set('cursor', params.cursor);
  if (params?.limit) query.set('limit', params.limit.toString());
  const qs = query.toString();
  const data = await apiClient<TransactionListResponse>(`/api/v1/wallet/transactions${qs ? `?${qs}` : ''}`);
  return runGuard(transactionListResponseGuard, data, 'GET /api/v1/wallet/transactions');
}
