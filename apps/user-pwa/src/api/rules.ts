import { apiClient } from './client.js';
import { runGuard, rulesResponseGuard, referralSummaryResponseGuard } from './guards.js';
import type { RulesResponse, ReferralSummaryResponse } from './types.js';

export async function getRules(): Promise<RulesResponse> {
  const data = await apiClient<RulesResponse>('/api/v1/rules');
  return runGuard(rulesResponseGuard, data, 'GET /api/v1/rules');
}

export async function getReferralSummary(): Promise<ReferralSummaryResponse> {
  const data = await apiClient<ReferralSummaryResponse>('/api/v1/me/referral-summary');
  return runGuard(referralSummaryResponseGuard, data, 'GET /api/v1/me/referral-summary');
}

export interface MatchRulesDto {
  imageUrl: string;
  rulesEn: string;
  rulesBn: string;
}

export async function fetchMatchRules(gameMode?: string): Promise<MatchRulesDto> {
  try {
    const endpoint = gameMode
      ? `/api/v1/rules/match-rules?gameMode=${encodeURIComponent(gameMode)}`
      : '/api/v1/rules/match-rules';
    const res = await apiClient<any>(endpoint);
    return res?.data || res;
  } catch {
    return {
      imageUrl: '',
      rulesEn: '',
      rulesBn: '',
    };
  }
}
