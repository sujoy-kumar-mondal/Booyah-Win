import { apiClient } from './client.js';
import {
  runGuard,
  userMatchListResponseGuard,
  userMatchDetailResponseGuard,
  userMatchJoinResponseGuard,
  userTeamCreateResponseGuard,
  userTeamReplaceResponseGuard,
  userTeamDisbandResponseGuard,
  userTeamInvitesResponseGuard,
  userInviteActionResponseGuard,
  userMatchHistoryResponseGuard,
} from './guards.js';
import type { z } from 'zod';

export type MatchUserDto = z.infer<typeof userMatchDetailResponseGuard>['match'];
export type TeamDto = z.infer<typeof userTeamCreateResponseGuard>['team'];
export type TeamInviteDto = z.infer<typeof userTeamInvitesResponseGuard>['invites'][number];
export type MatchHistoryItem = z.infer<typeof userMatchHistoryResponseGuard>['items'][number];

export async function fetchMatches(): Promise<MatchUserDto[]> {
  const data = await apiClient<any>('/api/v1/matches');
  const validated = runGuard(userMatchListResponseGuard, data, 'GET /api/v1/matches');
  return validated.matches;
}

export async function fetchMatch(id: string): Promise<MatchUserDto> {
  const data = await apiClient<any>(`/api/v1/matches/${id}`);
  const validated = runGuard(userMatchDetailResponseGuard, data, `GET /api/v1/matches/${id}`);
  return validated.match;
}

export async function joinMatchSolo(id: string): Promise<{ message: string; matchId: string; joinedAt: string }> {
  const data = await apiClient<any>(`/api/v1/matches/${id}/join`, {
    method: 'POST',
  });
  return runGuard(userMatchJoinResponseGuard, data, `POST /api/v1/matches/${id}/join`);
}

export interface CreateTeamPayload {
  teamName?: string;
  memberFfIds: string[];
}

export async function createTeam(matchId: string, payload: CreateTeamPayload): Promise<TeamDto> {
  const data = await apiClient<any>(`/api/v1/matches/${matchId}/teams`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
  const validated = runGuard(userTeamCreateResponseGuard, data, `POST /api/v1/matches/${matchId}/teams`);
  return validated.team;
}

export interface ReplaceInvitePayload {
  oldFfId: string;
  newFfId: string;
}

export async function replaceTeamInvite(matchId: string, payload: ReplaceInvitePayload): Promise<{ message: string }> {
  const data = await apiClient<any>(`/api/v1/matches/${matchId}/teams/mine/replace`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
  return runGuard(userTeamReplaceResponseGuard, data, `POST /api/v1/matches/${matchId}/teams/mine/replace`);
}

export async function disbandTeam(matchId: string): Promise<{ message: string }> {
  const data = await apiClient<any>(`/api/v1/matches/${matchId}/teams/mine`, {
    method: 'DELETE',
  });
  return runGuard(userTeamDisbandResponseGuard, data, `DELETE /api/v1/matches/${matchId}/teams/mine`);
}

export async function fetchTeamInvites(): Promise<TeamInviteDto[]> {
  const data = await apiClient<any>('/api/v1/me/team-invites');
  const validated = runGuard(userTeamInvitesResponseGuard, data, 'GET /api/v1/me/team-invites');
  return validated.invites;
}

export async function acceptTeamInvite(inviteId: string): Promise<{ message: string }> {
  const data = await apiClient<any>(`/api/v1/team-invites/${inviteId}/accept`, {
    method: 'POST',
  });
  return runGuard(userInviteActionResponseGuard, data, `POST /api/v1/team-invites/${inviteId}/accept`);
}

export async function declineTeamInvite(inviteId: string): Promise<{ message: string }> {
  const data = await apiClient<any>(`/api/v1/team-invites/${inviteId}/decline`, {
    method: 'POST',
  });
  return runGuard(userInviteActionResponseGuard, data, `POST /api/v1/team-invites/${inviteId}/decline`);
}

export interface MatchHistoryQueryParams {
  cursor?: string;
  limit?: number;
  gameMode?: string;
  teamMode?: string;
}

export async function fetchMatchHistory(params?: MatchHistoryQueryParams): Promise<{
  items: MatchHistoryItem[];
  nextCursor?: string | null;
  hasMore: boolean;
}> {
  const query = new URLSearchParams();
  if (params?.cursor) query.set('cursor', params.cursor);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.gameMode && params.gameMode !== 'all') query.set('gameMode', params.gameMode);
  if (params?.teamMode && params.teamMode !== 'all') query.set('teamMode', params.teamMode);

  const queryString = query.toString();
  const url = queryString ? `/api/v1/me/match-history?${queryString}` : '/api/v1/me/match-history';
  const data = await apiClient<any>(url);
  return runGuard(userMatchHistoryResponseGuard, data, 'GET /api/v1/me/match-history');
}
