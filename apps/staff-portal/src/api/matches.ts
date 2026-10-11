/**
 * Matches and Results API client functions for Booyah Win Staff Portal
 *
 * Rules:
 * - Real API shapes only.
 * - FormData uploads preserve multipart encoding without Content-Type: application/json.
 * - Room passwords, screenshot signed URLs, and tokens are NEVER logged.
 */

import { apiClient } from './client.js';
export * from './types.js';
import type {
  EntryTiersResponse,
  CreateMatchRequest,
  CreateMatchResponse,
  MatchListResponse,
  MatchDetailResponse,
  GenericMessageResponse,
  SubmitResultResponse,
  MatchResultStaffDto,
  AdminQueueResponse,
  ResultPayoutPreviewDto,
  ApproveResultResponse,
  RejectResultResponse,
  ReverseResultResponse,
} from './types.js';
import {
  runGuard,
  entryTiersResponseGuard,
  matchListResponseGuard,
  matchDetailResponseGuard,
  matchResultStaffGuard,
  adminQueueResponseGuard,
  resultPayoutPreviewGuard,
  matchStaffDtoGuard,
} from './guards.js';
import { z } from 'zod';

export async function getStaffEntryTiers(): Promise<EntryTiersResponse> {
  const data = await apiClient.get<EntryTiersResponse>('/staff/entry-tiers');
  return runGuard(entryTiersResponseGuard, data, 'GET /staff/entry-tiers');
}

export async function createStaffMatch(
  payload: CreateMatchRequest
): Promise<CreateMatchResponse> {
  const data = await apiClient.post<CreateMatchResponse>('/staff/matches', payload);
  return runGuard(
    z.object({ match: matchStaffDtoGuard }).passthrough(),
    data,
    'POST /staff/matches'
  );
}

export async function getStaffMatches(params?: {
  status?: string;
  gameMode?: string;
  teamMode?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}): Promise<MatchListResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'all') {
    query.set('status', params.status);
  }
  if (params?.gameMode && params.gameMode !== 'all') {
    query.set('gameMode', params.gameMode);
  }
  if (params?.teamMode && params.teamMode !== 'all') {
    query.set('teamMode', params.teamMode);
  }
  if (params?.from) {
    query.set('from', params.from);
  }
  if (params?.to) {
    query.set('to', params.to);
  }
  if (params?.limit) {
    query.set('limit', String(params.limit));
  }
  if (params?.cursor) {
    query.set('cursor', params.cursor);
  }

  const qs = query.toString();
  const endpoint = qs ? `/staff/matches?${qs}` : '/staff/matches';
  const data = await apiClient.get<MatchListResponse>(endpoint);
  return runGuard(matchListResponseGuard, data, 'GET /staff/matches');
}

export async function getStaffMatchDetail(
  matchId: string
): Promise<MatchDetailResponse> {
  const data = await apiClient.get<MatchDetailResponse>(`/staff/matches/${matchId}`);
  return runGuard(matchDetailResponseGuard, data, `GET /staff/matches/${matchId}`);
}

export async function openStaffMatchRoom(
  matchId: string,
  roomId: string,
  roomPassword: string
): Promise<GenericMessageResponse> {
  return apiClient.post<GenericMessageResponse>(
    `/staff/matches/${matchId}/open-room`,
    { roomId, roomPassword }
  );
}

export async function goLiveStaffMatch(
  matchId: string
): Promise<GenericMessageResponse> {
  return apiClient.post<GenericMessageResponse>(
    `/staff/matches/${matchId}/go-live`
  );
}

export async function cancelStaffMatch(
  matchId: string,
  reason: string
): Promise<GenericMessageResponse> {
  return apiClient.post<GenericMessageResponse>(
    `/staff/matches/${matchId}/cancel`,
    { reason }
  );
}

export async function submitStaffMatchResult(
  matchId: string,
  formData: FormData
): Promise<SubmitResultResponse> {
  return apiClient.post<SubmitResultResponse>(
    `/staff/matches/${matchId}/result`,
    formData
  );
}

export async function getStaffMatchResult(
  matchId: string
): Promise<MatchResultStaffDto> {
  const data = await apiClient.get<MatchResultStaffDto>(
    `/staff/matches/${matchId}/result`
  );
  return runGuard(matchResultStaffGuard, data, `GET /staff/matches/${matchId}/result`);
}

// ─── Admin Results Queue & Actions ──────────────────────────────────────────

export async function getAdminResultsQueue(): Promise<AdminQueueResponse> {
  const data = await apiClient.get<AdminQueueResponse>('/admin/results');
  return runGuard(adminQueueResponseGuard, data, 'GET /admin/results');
}

export async function getAdminResultPreview(
  matchId: string
): Promise<ResultPayoutPreviewDto> {
  const data = await apiClient.get<ResultPayoutPreviewDto>(
    `/admin/results/${matchId}/preview`
  );
  return runGuard(resultPayoutPreviewGuard, data, `GET /admin/results/${matchId}/preview`);
}

export async function approveAdminResult(
  matchId: string
): Promise<ApproveResultResponse> {
  return apiClient.post<ApproveResultResponse>(
    `/admin/results/${matchId}/approve`
  );
}

export async function rejectAdminResult(
  matchId: string,
  reason: string
): Promise<RejectResultResponse> {
  return apiClient.post<RejectResultResponse>(
    `/admin/results/${matchId}/reject`,
    { reason }
  );
}

export async function reverseAdminResult(
  matchId: string,
  reason: string
): Promise<ReverseResultResponse> {
  return apiClient.post<ReverseResultResponse>(
    `/admin/results/${matchId}/reverse`,
    { reason }
  );
}
