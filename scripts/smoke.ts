/**
 * Smoke Test Script for Booyah Win
 *
 * Requirements:
 * - Refuses to run unless NODE_ENV is "test" and TEST_DATABASE_URL ends in "_test"
 * - Safe stand-ins for import.meta.env and storage that do not alter guard behavior
 * - Step 1: Run frontend API guards under development mode
 * - Step 2: Run the same calls with production guard setting
 * - Step 3: Build both frontends in production mode (must succeed)
 * - Never prints OTPs, tokens or URLs
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// ─── Safety Pre-Checks ────────────────────────────────────────────────────────
const nodeEnv = process.env.NODE_ENV;
if (nodeEnv !== 'test') {
  console.error('[SMOKE ERROR] Refusing to run: NODE_ENV must be "test", got: ' + (nodeEnv || '(unset)'));
  process.exit(1);
}

const testDbUrl = process.env.TEST_DATABASE_URL || '';
if (!testDbUrl.endsWith('_test')) {
  console.error('[SMOKE ERROR] Refusing to run: TEST_DATABASE_URL must end in "_test"');
  process.exit(1);
}

// ─── Safe Stand-ins for Storage and Environment ──────────────────────────────
class SafeStorage implements Storage {
  private items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  clear(): void {
    this.items.clear();
  }
  getItem(key: string): string | null {
    return this.items.has(key) ? this.items.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }
}

if (typeof (globalThis as any).sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = new SafeStorage();
}
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = new SafeStorage();
}

// ─── Contracts & Guards Setup ─────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CONTRACTS_DIR = path.join(ROOT_DIR, 'docs', 'contracts');

// Import guards from both applications
import * as staffGuards from '../apps/staff-portal/src/api/guards.js';
import * as pwaGuards from '../apps/user-pwa/src/api/guards.js';

function readFixture(filename: string): any {
  const filepath = path.join(CONTRACTS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Fixture file not found: ${filename}`);
  }
  const raw = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  return raw.data !== undefined ? raw.data : raw;
}

interface SmokeCall {
  app: 'staff-portal' | 'user-pwa';
  endpoint: string;
  fixture: string;
  guard: any;
}

const smokeCalls: SmokeCall[] = [
  // Staff Portal Endpoints
  {
    app: 'staff-portal',
    endpoint: '/staff/me',
    fixture: 'GET_staff_me.json',
    guard: staffGuards.staffMeGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/auth/login/verify-otp',
    fixture: 'POST_staff_auth_login_verify-otp.json',
    guard: staffGuards.staffLoginResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/dashboard',
    fixture: 'GET_staff_dashboard.json',
    guard: staffGuards.dashboardMetricsGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/entry-tiers',
    fixture: 'GET_staff_entry-tiers.json',
    guard: staffGuards.entryTiersResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/matches',
    fixture: 'GET_staff_matches.json',
    guard: staffGuards.matchListResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/matches/:id',
    fixture: 'GET_staff_matches_id__solo.json',
    guard: staffGuards.matchDetailResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/admin/results/queue',
    fixture: 'GET_admin_results__pending.json',
    guard: staffGuards.adminQueueResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/admin/results/:id/preview',
    fixture: 'GET_admin_results_preview__normal.json',
    guard: staffGuards.resultPayoutPreviewGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/matches/:id/result',
    fixture: 'GET_staff_matches_id_result__pending.json',
    guard: staffGuards.matchResultStaffGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/deposits',
    fixture: 'GET_staff_deposits.json',
    guard: staffGuards.depositListResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/deposits/:id/verify',
    fixture: 'POST_staff_deposits_id_verify.json',
    guard: staffGuards.staffActionResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/deposits/:id/approve',
    fixture: 'POST_staff_deposits_id_approve.json',
    guard: staffGuards.staffActionResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/withdrawals',
    fixture: 'GET_staff_withdrawals.json',
    guard: staffGuards.withdrawalListResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/withdrawals/:id/verify',
    fixture: 'POST_staff_withdrawals_id_verify.json',
    guard: staffGuards.staffActionResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/withdrawals/:id/mark-paid',
    fixture: 'POST_staff_withdrawals_id_mark-paid.json',
    guard: staffGuards.staffActionResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/employees',
    fixture: 'GET_admin_employees.json',
    guard: staffGuards.employeeListResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/employees',
    fixture: 'POST_admin_employees.json',
    guard: staffGuards.employeeSingleResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/employees/:id',
    fixture: 'PATCH_admin_employees_id.json',
    guard: staffGuards.employeeSingleResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/employees/:id',
    fixture: 'DELETE_admin_employees_id.json',
    guard: staffGuards.employeeDeleteResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/tiers',
    fixture: 'GET_admin_tiers.json',
    guard: staffGuards.entryTiersResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/tiers',
    fixture: 'POST_admin_tiers.json',
    guard: staffGuards.createTierResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/tiers/:id',
    fixture: 'PATCH_admin_tiers_id.json',
    guard: staffGuards.updateTierResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/tiers/:id',
    fixture: 'DELETE_admin_tiers_id.json',
    guard: staffGuards.deleteTierResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/users',
    fixture: 'GET_admin_users.json',
    guard: staffGuards.adminUserListResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/users/:id',
    fixture: 'GET_admin_users_id.json',
    guard: staffGuards.adminUserDetailResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/users/:id',
    fixture: 'DELETE_admin_users_id.json',
    guard: staffGuards.adminUserDeleteResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/users/:id/adjust',
    fixture: 'POST_admin_users_id_adjust.json',
    guard: staffGuards.adminUserAdjustResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/settings',
    fixture: 'GET_admin_settings.json',
    guard: staffGuards.adminSettingsResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/settings',
    fixture: 'PATCH_admin_settings.json',
    guard: staffGuards.adminSettingsResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/settings/payment-qr',
    fixture: 'POST_admin_settings_payment-qr.json',
    guard: staffGuards.adminUploadPaymentQrResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/admin/audit-logs',
    fixture: 'GET_admin_audit-logs.json',
    guard: staffGuards.adminAuditLogsResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/status',
    fixture: 'GET_api_v1_status.json',
    guard: staffGuards.statusResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/users',
    fixture: 'GET_staff_users.json',
    guard: staffGuards.staffUserListResponseGuard,
  },
  {
    app: 'staff-portal',
    endpoint: '/staff/users/:id',
    fixture: 'GET_staff_users_id.json',
    guard: staffGuards.staffUserDetailResponseGuard,
  },

  // User PWA Endpoints
  {
    app: 'user-pwa',
    endpoint: '/api/v1/status',
    fixture: 'GET_api_v1_status.json',
    guard: pwaGuards.statusResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/me',
    fixture: 'GET_api_v1_me.json',
    guard: pwaGuards.getMeGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/auth/login/verify-otp',
    fixture: 'POST_api_v1_auth_login_verify-otp.json',
    guard: pwaGuards.loginVerifyResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/auth/register/verify-otp',
    fixture: 'POST_api_v1_auth_register_verify-otp.json',
    guard: pwaGuards.registerVerifyResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/auth/register/complete',
    fixture: 'POST_api_v1_auth_register_complete.json',
    guard: pwaGuards.registerCompleteResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/payment-info',
    fixture: 'GET_api_v1_payment-info.json',
    guard: pwaGuards.paymentInfoDtoGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/wallet/deposits (item)',
    fixture: 'POST_api_v1_wallet_deposits.json',
    guard: pwaGuards.depositDtoGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/wallet/deposits (list)',
    fixture: 'GET_api_v1_wallet_deposits.json',
    guard: pwaGuards.depositListResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/wallet/withdrawals (item)',
    fixture: 'POST_api_v1_wallet_withdrawals.json',
    guard: pwaGuards.withdrawalDtoGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/wallet/withdrawals (list)',
    fixture: 'GET_api_v1_wallet_withdrawals.json',
    guard: pwaGuards.withdrawalListResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/wallet/transactions',
    fixture: 'GET_api_v1_wallet_transactions.json',
    guard: pwaGuards.transactionListResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/matches',
    fixture: 'GET_api_v1_matches.json',
    guard: pwaGuards.userMatchListResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/matches/:id',
    fixture: 'GET_api_v1_matches_id.json',
    guard: pwaGuards.userMatchDetailResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/matches/:id/join',
    fixture: 'POST_api_v1_matches_id_join.json',
    guard: pwaGuards.userMatchJoinResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/matches/:id/teams',
    fixture: 'POST_api_v1_matches_id_teams.json',
    guard: pwaGuards.userTeamCreateResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/matches/:id/teams/mine/replace',
    fixture: 'POST_api_v1_matches_id_teams_mine_replace.json',
    guard: pwaGuards.userTeamReplaceResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/matches/:id/teams/mine',
    fixture: 'DELETE_api_v1_matches_id_teams_mine.json',
    guard: pwaGuards.userTeamDisbandResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/me/team-invites',
    fixture: 'GET_api_v1_me_team-invites.json',
    guard: pwaGuards.userTeamInvitesResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/team-invites/:id/accept',
    fixture: 'POST_api_v1_team-invites_id_accept.json',
    guard: pwaGuards.userInviteActionResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/team-invites/:id/decline',
    fixture: 'POST_api_v1_team-invites_id_decline.json',
    guard: pwaGuards.userInviteActionResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/me/match-history',
    fixture: 'GET_api_v1_me_match-history.json',
    guard: pwaGuards.userMatchHistoryResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/support',
    fixture: 'GET_api_v1_support.json',
    guard: pwaGuards.userSupportInfoResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/leaderboard',
    fixture: 'GET_api_v1_leaderboard__populated.json',
    guard: pwaGuards.leaderboardResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/me/leaderboard-rank',
    fixture: 'GET_api_v1_me_leaderboard-rank__ranked.json',
    guard: pwaGuards.leaderboardRankResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/rules',
    fixture: 'GET_api_v1_rules.json',
    guard: pwaGuards.rulesResponseGuard,
  },
  {
    app: 'user-pwa',
    endpoint: '/api/v1/me/referral-summary',
    fixture: 'GET_api_v1_me_referral-summary.json',
    guard: pwaGuards.referralSummaryResponseGuard,
  },
];

async function runSmoke() {
  console.log('[SMOKE] Starting smoke suite...');
  console.log(`[SMOKE] Safety checks verified: NODE_ENV=${nodeEnv}, database target verified.`);

  // ─── Step 1: Dev Guard Verification ─────────────────────────────────────────
  console.log('\n[SMOKE] Step 1: Testing frontend API guards in development mode...');
  process.env.NODE_ENV = 'test';
  for (const call of smokeCalls) {
    const payload = readFixture(call.fixture);
    const runner = call.app === 'staff-portal' ? staffGuards.runGuard : pwaGuards.runGuard;
    try {
      runner(call.guard, payload, call.endpoint);
    } catch (err: any) {
      console.error(`[SMOKE FAILURE] Dev guard failed on ${call.app} ${call.endpoint}:`, err?.message);
      process.exit(1);
    }
  }
  console.log(`[SMOKE] Step 1 passed: All ${smokeCalls.length} calls validated cleanly under development guard mode.`);

  // ─── Step 2: Production Guard Verification ──────────────────────────────────
  console.log('\n[SMOKE] Step 2: Testing frontend API guards in production mode...');
  process.env.NODE_ENV = 'production';
  for (const call of smokeCalls) {
    const payload = readFixture(call.fixture);
    // Also inject an undocumented telemetry key to verify passthrough tolerance in production
    const payloadWithExtra = JSON.parse(JSON.stringify(payload));
    if (typeof payloadWithExtra === 'object' && payloadWithExtra !== null && !Array.isArray(payloadWithExtra)) {
      payloadWithExtra.__smokeExtraTelemetry = 'prod-passthrough-ok';
    }
    const runner = call.app === 'staff-portal' ? staffGuards.runGuard : pwaGuards.runGuard;
    try {
      runner(call.guard, payloadWithExtra, call.endpoint);
    } catch (err: any) {
      console.error(`[SMOKE FAILURE] Production guard failed on ${call.app} ${call.endpoint}:`, err?.message);
      process.exit(1);
    }
  }
  process.env.NODE_ENV = 'test';
  console.log(`[SMOKE] Step 2 passed: All ${smokeCalls.length} calls validated cleanly under production guard mode.`);

  // ─── Step 3: Production Build of Both Frontends ─────────────────────────────
  console.log('\n[SMOKE] Step 3: Building apps/staff-portal in production mode...');
  try {
    execSync('npm run build --workspace=apps/staff-portal', {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
    });
    console.log('[SMOKE] apps/staff-portal production build succeeded.');
  } catch (err: any) {
    console.error('[SMOKE FAILURE] apps/staff-portal build failed:');
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }

  console.log('\n[SMOKE] Step 3 (cont): Building apps/user-pwa in production mode...');
  try {
    execSync('npm run build --workspace=apps/user-pwa', {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
    });
    console.log('[SMOKE] apps/user-pwa production build succeeded.');
  } catch (err: any) {
    console.error('[SMOKE FAILURE] apps/user-pwa build failed:');
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }

  console.log('\n[SMOKE SUCCESS] All smoke steps passed cleanly without error.');
}

runSmoke().catch((err) => {
  console.error('[SMOKE FATAL ERROR]', err?.message || err);
  process.exit(1);
});
