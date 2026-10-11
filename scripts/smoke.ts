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
    endpoint: '/staff/withdrawals',
    fixture: 'GET_staff_withdrawals.json',
    guard: staffGuards.withdrawalListResponseGuard,
  },

  // User PWA Endpoints
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
