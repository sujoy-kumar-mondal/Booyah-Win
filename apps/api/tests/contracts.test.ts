/**
 * Real API Contracts Generator & Strict Parity Verifier
 *
 * Requirements:
 * 1. Executes real app against test database with real entities (users, tiers, solo, duo, CS, deposits, withdrawals, results, errors).
 * 2. Seeds through real endpoints where possible; direct DB inserts only for unreachable states.
 * 3. Sanitizes all volatile / sensitive values (tokens, passwords, emails, URLs, long hex strings) into fixed placeholders while preserving all keys and types.
 * 4. Captures named variants per state (solo, duo, clash squad, room open/no room, pending/approved/rejected results, empty/pending queues, payout previews).
 * 5. Generates/updates docs/contracts/<NAME>.json when GENERATE_CONTRACTS=true ("npm run contracts"); normal test run verifies live responses against stored files without rewriting.
 * 6. Dynamic Frontend Usage Manifest: scans apps/user-pwa and apps/staff-portal API modules and fails if any used endpoint lacks a contract.
 * 7. Fake Data Audit: fails if any contract contains a real token, non-placeholder email, long hex string, or test env secrets.
 */

import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { testOtpStore } from '../src/utils/email.js';

const app = createApp({ enableRateLimiting: false });
const GENERATE_CONTRACTS = process.env.GENERATE_CONTRACTS === 'true';
const CONTRACTS_DIR = path.resolve(__dirname, '../../../docs/contracts');

// Ensure docs/contracts directory exists
if (!fs.existsSync(CONTRACTS_DIR)) {
  fs.mkdirSync(CONTRACTS_DIR, { recursive: true });
}

// 1x1 valid PNG buffer for screenshot uploads
const validPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

// ─── Sanitizer Helper ──────────────────────────────────────────────────────────
export function sanitizeContractData(val: any, keyName?: string): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'number' || typeof val === 'boolean') return val;

  if (typeof val === 'string') {
    // JWT token
    if (/^ey[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]{15,}/.test(val)) {
      return 'test-token-placeholder';
    }
    // Screenshot / signed storage URL or file path/name
    if (
      keyName === 'screenshotUrl' ||
      keyName === 'signedScreenshotUrl' ||
      val.startsWith('http://') ||
      val.startsWith('https://') ||
      val.startsWith('/uploads/') ||
      val.includes('/files/') ||
      /\.(png|jpe?g|webp)$/i.test(val)
    ) {
      return 'https://storage.example.com/placeholder.jpg';
    }
    // Long hex string (length >= 32)
    if (/[0-9a-fA-F]{32,}/.test(val)) {
      return val.replace(/[0-9a-fA-F]{32,}/g, '0123456789abcdef');
    }
    // Room password
    if (keyName === 'roomPassword' || val === 'roomSecret123' || val === 'secretpassword') {
      return 'test-room-password';
    }
    // UTR
    if (keyName === 'utr') {
      return '123456789012';
    }
    // Payout ref
    if (keyName === 'payoutRef') {
      return 'REF123456789';
    }
    // Staff email
    if (val.includes('@booyah.win')) {
      return 'staff@booyah.win';
    }
    // Support email
    if (val.includes('@booyahwin.com')) {
      return 'support@booyahwin.com';
    }
    // User email
    if (val.includes('@') && val.includes('.')) {
      return 'user@example.com';
    }
    // FreeFire ID
    if (/^FF\d+/.test(val) || val === 'FF_PRO_10') {
      return 'FF_PLAYER_123';
    }
    // Mobile number
    if (/^\+?91\d{10}$/.test(val) || /^9\d{9}$/.test(val)) {
      return '9999999999';
    }
    // UPI ID
    if (keyName === 'upiId' || /^[a-zA-Z0-9.\-_]+@[a-zA-Z]+$/.test(val)) {
      return 'user@upi';
    }
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((item) => sanitizeContractData(item, keyName));
  }

  if (typeof val === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = sanitizeContractData(v, k);
    }
    return res;
  }

  return val;
}

// ─── Deep Key Set Extraction ──────────────────────────────────────────────────
export function extractKeySet(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const keys: string[] = [];
  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      keys.push(...extractKeySet(obj[0], `${prefix}[]`));
    }
    return keys;
  }
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    keys.push(fullKey);
    if (v && typeof v === 'object') {
      keys.push(...extractKeySet(v, fullKey));
    }
  }
  return keys.sort();
}

// ─── Save or Verify Helper ────────────────────────────────────────────────────
function saveOrVerifyContract(filename: string, rawBody: any) {
  const sanitized = sanitizeContractData(rawBody);
  const filePath = path.join(CONTRACTS_DIR, filename);

  if (GENERATE_CONTRACTS) {
    fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2) + '\n', 'utf-8');
  } else {
    expect(fs.existsSync(filePath), `Contract file missing: ${filename}`).toBe(true);
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const actualKeys = extractKeySet(sanitized);
    const expectedKeys = extractKeySet(existing);
    expect(actualKeys).toEqual(expectedKeys);
  }
}

// ─── Frontend Manifest Scanner ────────────────────────────────────────────────
export function getFrontendEndpoints(): Array<{ method: string; path: string; source: string }> {
  const endpoints: Array<{ method: string; path: string; source: string }> = [];

  const scanFile = (filePath: string) => {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');

    // 1. apiClient.get<...>(url), apiClient.post<...>(url), etc.
    const methodDotRegex = /apiClient\.(get|post|patch|delete)(?:<[^>]+>)?\s*\(\s*[`'"]([/a-zA-Z0-9_\-:${}?=&]+)[`'"]/g;
    let match: RegExpExecArray | null;
    while ((match = methodDotRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      let routePath = match[2].split('?')[0];
      routePath = routePath.replace(/\$\{[^}]+\}/g, ':id');
      const normalizedPath = routePath.startsWith('/api/v1') ? routePath.replace('/api/v1', '') : routePath;
      endpoints.push({ method, path: normalizedPath, source: path.basename(filePath) });
    }

    // 2. apiClient<...>(url, { method: 'POST' })
    const clientOptionsRegex = /apiClient(?:<[^>]+>)?\s*\(\s*[`'"]([/a-zA-Z0-9_\-:${}?=&]+)[`'"]\s*,\s*\{[^}]*?method:\s*['"]([A-Z]+)['"]/gs;
    while ((match = clientOptionsRegex.exec(content)) !== null) {
      let routePath = match[1].split('?')[0];
      routePath = routePath.replace(/\$\{[^}]+\}/g, ':id');
      const normalizedPath = routePath.startsWith('/api/v1') ? routePath.replace('/api/v1', '') : routePath;
      const method = match[2].toUpperCase();
      endpoints.push({ method, path: normalizedPath, source: path.basename(filePath) });
    }

    // 3. apiClient<...>(url) [without method -> defaults to GET]
    const clientDefaultGetRegex = /apiClient(?:<[^>]+>)?\s*\(\s*[`'"]([/a-zA-Z0-9_\-:${}?=&]+)[`'"]\s*\)/g;
    while ((match = clientDefaultGetRegex.exec(content)) !== null) {
      let routePath = match[1].split('?')[0];
      routePath = routePath.replace(/\$\{[^}]+\}/g, ':id');
      const normalizedPath = routePath.startsWith('/api/v1') ? routePath.replace('/api/v1', '') : routePath;
      endpoints.push({ method: 'GET', path: normalizedPath, source: path.basename(filePath) });
    }
  };

  const pwaApiDir = path.resolve(__dirname, '../../../apps/user-pwa/src/api');
  if (fs.existsSync(pwaApiDir)) {
    fs.readdirSync(pwaApiDir).forEach((f) => {
      if (f.endsWith('.ts')) scanFile(path.join(pwaApiDir, f));
    });
  }

  const staffApiDir = path.resolve(__dirname, '../../../apps/staff-portal/src/api');
  if (fs.existsSync(staffApiDir)) {
    fs.readdirSync(staffApiDir).forEach((f) => {
      if (f.endsWith('.ts')) scanFile(path.join(staffApiDir, f));
    });
  }

  // De-duplicate endpoints
  const seen = new Set<string>();
  return endpoints.filter((ep) => {
    const key = `${ep.method} ${ep.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe('Real API Contracts Generator & Strict Parity Verifier', () => {
  let adminToken: string;
  let employeeToken: string;
  let userToken: string;
  let user2Token: string;
  let adminId: string;
  let employeeId: string;
  let userId: string;
  let user2Id: string;
  let tierId: string;
  let duoTierId: string;
  let csTierId: string;
  let soloMatchId: string;
  let duoMatchId: string;
  let csMatchId: string;
  let resultMatchId: string;
  let rejectedMatchId: string;
  let cancelledMatchId: string;
  let depositId: string;
  let withdrawalId: string;
  let teamId: string;
  let inviteId: string;
  let logoutStaffToken: string;
  let logoutUserToken: string;
  let newPlayerToken: string;

  beforeAll(async () => {
    await truncateAllTables();

    // 1. Seed Staff Members
    const adminRes = await query(
      `INSERT INTO staff (email, name, mobile, role)
       VALUES ('admin@booyah.win', 'Admin User', '9999990001', 'admin')
       RETURNING id`
    );
    adminId = adminRes.rows[0].id.toString();

    const empRes = await query(
      `INSERT INTO staff (email, name, mobile, role)
       VALUES ('employee@booyah.win', 'Employee User', '9999990002', 'employee')
       RETURNING id`
    );
    employeeId = empRes.rows[0].id.toString();

    // 2. Staff Logins via real endpoint
    await request(app)
      .post('/api/v1/staff/auth/login/request-otp')
      .send({ email: 'admin@booyah.win' });
    const adminOtp = testOtpStore.get('admin@booyah.win');
    const adminLoginRes = await request(app)
      .post('/api/v1/staff/auth/login/verify-otp')
      .send({ email: 'admin@booyah.win', otp: adminOtp });
    adminToken = adminLoginRes.body.data.token;

    await query(`UPDATE otp_requests SET created_at = NOW() - interval '2 minutes'`);
    await request(app)
      .post('/api/v1/staff/auth/login/request-otp')
      .send({ email: 'employee@booyah.win' });
    const empOtp = testOtpStore.get('employee@booyah.win');
    const empLoginRes = await request(app)
      .post('/api/v1/staff/auth/login/verify-otp')
      .send({ email: 'employee@booyah.win', otp: empOtp });
    employeeToken = empLoginRes.body.data.token;

    // 3. User 1 Registration & Login via real endpoints
    await request(app)
      .post('/api/v1/auth/register/request-otp')
      .send({ email: 'player1@example.com' });
    const regOtp = testOtpStore.get('player1@example.com');
    const regVerifyRes = await request(app)
      .post('/api/v1/auth/register/verify-otp')
      .send({ email: 'player1@example.com', otp: regOtp });
    const regToken = regVerifyRes.body.data.registrationToken;

    const regCompRes = await request(app)
      .post('/api/v1/auth/register/complete')
      .send({
        registrationToken: regToken,
        name: 'Player One',
        mobile: '9876543210',
        ffId: '12345678',
        ffName: 'ProPlayer1',
        upiId: 'player1@upi',
        dateOfBirth: '2000-01-01',
        confirm18Plus: true,
      });
    userToken = regCompRes.body.data.token;
    userId = regCompRes.body.data.user.id;

    // User 2 Registration
    await query(`UPDATE otp_requests SET created_at = NOW() - interval '2 minutes'`);
    await request(app)
      .post('/api/v1/auth/register/request-otp')
      .send({ email: 'player2@example.com' });
    const regOtp2 = testOtpStore.get('player2@example.com');
    const regVerifyRes2 = await request(app)
      .post('/api/v1/auth/register/verify-otp')
      .send({ email: 'player2@example.com', otp: regOtp2 });
    const regToken2 = regVerifyRes2.body.data.registrationToken;

    const regCompRes2 = await request(app)
      .post('/api/v1/auth/register/complete')
      .send({
        registrationToken: regToken2,
        name: 'Player Two',
        mobile: '9876543211',
        ffId: '87654321',
        ffName: 'ProPlayer2',
        upiId: 'player2@upi',
        dateOfBirth: '2000-01-01',
        confirm18Plus: true,
      });
    user2Token = regCompRes2.body.data.token;
    user2Id = regCompRes2.body.data.user.id;

    // Credit money to both player wallets
    await query(`UPDATE wallets SET add_money = 200.00, winning = 200.00 WHERE user_id = $1`, [userId]);
    await query(`UPDATE wallets SET add_money = 200.00, winning = 200.00 WHERE user_id = $1`, [user2Id]);

    // Seed player3 for replace teammate tests
    await query(
      `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
       VALUES ('player3@example.com', 'Player Three', '9876543212', '55667788', 'ProPlayer3', 'player3@upi', '2000-01-01', 'REF_P3')`
    );

    // Dedicated dummy accounts for logout contracts (so employeeToken and userToken are never invalidated)
    const logoutStaffRes = await query(
      `INSERT INTO staff (email, name, mobile, role)
       VALUES ('logout_staff@booyah.win', 'Logout Staff', '9999990099', 'employee')
       RETURNING id`
    );
    const logoutStaffId = logoutStaffRes.rows[0].id.toString();
    const staffSidRes = await query(
      `INSERT INTO sessions (id, account_type, account_id)
       VALUES (gen_random_uuid(), 'staff', $1)
       RETURNING id`,
      [logoutStaffId]
    );
    logoutStaffToken = signSessionToken(
      { sub: logoutStaffId, typ: 'staff', sid: staffSidRes.rows[0].id, role: 'employee' },
      '1d'
    );

    const logoutUserRes = await query(
      `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
       VALUES ('logout_user@example.com', 'Logout User', '9999990088', '99881122', 'LogoutPro', 'logout@upi', '2000-01-01', 'LOGOUT01')
       RETURNING id`
    );
    const logoutUserId = logoutUserRes.rows[0].id.toString();
    const userSidRes = await query(
      `INSERT INTO sessions (id, account_type, account_id)
       VALUES (gen_random_uuid(), 'user', $1)
       RETURNING id`,
      [logoutUserId]
    );
    logoutUserToken = signSessionToken(
      { sub: logoutUserId, typ: 'user', sid: userSidRes.rows[0].id, role: 'user' },
      '1d'
    );

    // 4. Seed Entry Tiers
    const tierRes = await query(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
       VALUES ('battle_royale', 'solo', '20.00', '10.00', 1, 48, 2)
       RETURNING id`
    );
    tierId = tierRes.rows[0].id.toString();
    await query(
      `INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES
       ($1, 1, 300.00), ($1, 2, 150.00), ($1, 3, 50.00)`,
      [tierId]
    );

    const csRes = await query(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
       VALUES ('clash_squad', 'squad', '25.00', '0.00', 0, 8, 8)
       RETURNING id`
    );
    csTierId = csRes.rows[0].id.toString();
    await query(`INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES ($1, 1, 200.00)`, [csTierId]);

    // 5. Seed Matches via real endpoint
    const createSoloRes = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId, startTime: '2026-12-01T15:00:00.000Z' });
    soloMatchId = createSoloRes.body.data.match.id;

    // Join solo match
    await request(app)
      .post(`/api/v1/matches/${soloMatchId}/join`)
      .set('Authorization', `Bearer ${userToken}`);

    // Create Duo Match with confirmed team
    const duoTierRes = await query(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
       VALUES ('battle_royale', 'duo', '20.00', '10.00', 1, 48, 2)
       RETURNING id`
    );
    duoTierId = duoTierRes.rows[0].id.toString();
    await query(`INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES ($1, 1, 300.00)`, [duoTierId]);

    const createDuoRes = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId: duoTierId, startTime: '2026-12-01T16:00:00.000Z' });
    duoMatchId = createDuoRes.body.data.match.id;

    // Team in duo match
    const teamRes = await query(
      `INSERT INTO teams (match_id, name, size, status, leader_id)
       VALUES ($1, 'Alpha Team', 2, 'confirmed', $2) RETURNING id`,
      [duoMatchId, userId]
    );
    teamId = teamRes.rows[0].id.toString();
    await query(
      `INSERT INTO match_players (match_id, user_id, team_id, paid_add_money, paid_cashback, paid_winning, joined_at)
       VALUES ($1, $2, $3, 20.00, 0.00, 0.00, NOW())`,
      [duoMatchId, userId, teamId]
    );

    // Create Clash Squad Match
    const createCsRes = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId: csTierId, startTime: '2026-12-01T17:00:00.000Z' });
    csMatchId = createCsRes.body.data.match.id;
    const csTeamRes = await query(
      `INSERT INTO teams (match_id, name, size, status, leader_id)
       VALUES ($1, 'Blue Squad', 4, 'confirmed', $2) RETURNING id`,
      [csMatchId, userId]
    );
    await query(
      `INSERT INTO match_players (match_id, user_id, team_id, paid_add_money, paid_cashback, paid_winning, joined_at)
       VALUES ($1, $2, $3, 25.00, 0.00, 0.00, NOW())`,
      [csMatchId, userId, csTeamRes.rows[0].id]
    );

    // Room credentials on solo match
    await request(app)
      .post(`/api/v1/staff/matches/${soloMatchId}/open-room`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ roomId: '123456', roomPassword: 'roomSecret123' });

    // Match for result submissions (Live match with 2 players)
    const createResMatch = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId, startTime: '2026-12-01T18:00:00.000Z' });
    resultMatchId = createResMatch.body.data.match.id;
    await request(app)
      .post(`/api/v1/matches/${resultMatchId}/join`)
      .set('Authorization', `Bearer ${userToken}`);
    await request(app)
      .post(`/api/v1/matches/${resultMatchId}/join`)
      .set('Authorization', `Bearer ${user2Token}`);
    await request(app)
      .post(`/api/v1/staff/matches/${resultMatchId}/open-room`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ roomId: '998877', roomPassword: 'roomSecret123' });
    await request(app)
      .post(`/api/v1/staff/matches/${resultMatchId}/go-live`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Cancelled match
    const createCancelMatch = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId, startTime: '2026-12-01T19:00:00.000Z' });
    cancelledMatchId = createCancelMatch.body.data.match.id;
    await request(app)
      .post(`/api/v1/staff/matches/${cancelledMatchId}/cancel`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'Insufficient players for fair tournament' });

    // Match for rejected result variant
    const createRejMatch = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId, startTime: '2026-12-01T20:00:00.000Z' });
    rejectedMatchId = createRejMatch.body.data.match.id;
    await request(app)
      .post(`/api/v1/matches/${rejectedMatchId}/join`)
      .set('Authorization', `Bearer ${userToken}`);
    await request(app)
      .post(`/api/v1/matches/${rejectedMatchId}/join`)
      .set('Authorization', `Bearer ${user2Token}`);
    await request(app)
      .post(`/api/v1/staff/matches/${rejectedMatchId}/open-room`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ roomId: '334455', roomPassword: 'roomSecret123' });
    await request(app)
      .post(`/api/v1/staff/matches/${rejectedMatchId}/go-live`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Submit pending result on resultMatchId
    await request(app)
      .post(`/api/v1/staff/matches/${resultMatchId}/result`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .field(
        'entries',
        JSON.stringify([
          { userId, kills: 1, position: 1 },
          { userId: user2Id, kills: 0, position: 2 },
        ])
      )
      .attach('screenshot', validPngBuffer, 'screenshot.png');

    // Deposit and Withdrawal
    const depRes = await request(app)
      .post('/api/v1/wallet/deposits')
      .set('Authorization', `Bearer ${userToken}`)
      .field('amount', '50.00')
      .field('utr', '123456789012')
      .attach('screenshot', validPngBuffer, 'deposit.png');
    depositId = depRes.body.data.id;

    const wRes = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amount: '50.00', upiId: 'player1@upi', confirm: true });
    withdrawalId = wRes.body.data.id;
  });

  // ─── 1. Public Endpoints Contracts ──────────────────────────────────────────
  it('captures GET /api/v1/support variants', async () => {
    // 1. Not configured variant (phone/email empty by default)
    const res = await request(app).get('/api/v1/support');
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_support.json', res.body);
    saveOrVerifyContract('GET_api_v1_support__not_configured.json', res.body);

    // 2. Configured variant
    await query(
      `INSERT INTO app_settings (key, value) VALUES
       ('support_name', 'Booyah Win Support'),
       ('support_phone', '+91 9999999999'),
       ('support_email', 'support@booyahwin.com'),
       ('support_hours', '10:00 AM - 10:00 PM IST')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    );
    const confRes = await request(app).get('/api/v1/support');
    expect(confRes.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_support__configured.json', confRes.body);

    // Revert settings to avoid side effects
    await query(`UPDATE app_settings SET value = '' WHERE key IN ('support_phone', 'support_email')`);
  });

  it('captures GET /api/v1/payment-info', async () => {
    const res = await request(app).get('/api/v1/payment-info');
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_payment-info.json', res.body);
  });

  // ─── 2. User Auth Endpoints Contracts ───────────────────────────────────────
  it('captures POST /api/v1/auth/register/request-otp', async () => {
    await query(`UPDATE otp_requests SET created_at = NOW() - interval '2 minutes'`);
    const res = await request(app)
      .post('/api/v1/auth/register/request-otp')
      .send({ email: 'newplayer_contract@example.com' });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_api_v1_auth_register_request-otp.json', res.body);
  });

  it('captures POST /api/v1/auth/register/verify-otp', async () => {
    const otp = testOtpStore.get('newplayer_contract@example.com');
    const res = await request(app)
      .post('/api/v1/auth/register/verify-otp')
      .send({ email: 'newplayer_contract@example.com', otp });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_api_v1_auth_register_verify-otp.json', res.body);
  });

  it('captures POST /api/v1/auth/register/complete', async () => {
    await query(`UPDATE otp_requests SET created_at = NOW() - interval '2 minutes'`);
    await request(app)
      .post('/api/v1/auth/register/request-otp')
      .send({ email: 'complete_player@example.com' });
    const otp = testOtpStore.get('complete_player@example.com');
    const vRes = await request(app)
      .post('/api/v1/auth/register/verify-otp')
      .send({ email: 'complete_player@example.com', otp });
    const regToken = vRes.body.data.registrationToken;

    const res = await request(app)
      .post('/api/v1/auth/register/complete')
      .send({
        registrationToken: regToken,
        name: 'New Player',
        mobile: '9876543299',
        ffId: '99887766',
        ffName: 'NewPlayerPro',
        upiId: 'newplayer@upi',
        dateOfBirth: '2000-01-01',
        confirm18Plus: true,
      });
    expect(res.status).toBe(200);
    newPlayerToken = res.body.data.token;
    saveOrVerifyContract('POST_api_v1_auth_register_complete.json', res.body);
  });

  it('captures POST /api/v1/auth/login/request-otp', async () => {
    await query(`UPDATE otp_requests SET created_at = NOW() - interval '2 minutes'`);
    const res = await request(app)
      .post('/api/v1/auth/login/request-otp')
      .send({ email: 'player1@example.com' });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_api_v1_auth_login_request-otp.json', res.body);
  });

  it('captures POST /api/v1/auth/login/verify-otp', async () => {
    const otp = testOtpStore.get('player1@example.com');
    const res = await request(app)
      .post('/api/v1/auth/login/verify-otp')
      .send({ email: 'player1@example.com', otp });
    expect(res.status).toBe(200);
    userToken = res.body.data.token;
    saveOrVerifyContract('POST_api_v1_auth_login_verify-otp.json', res.body);
  });

  it('captures POST /api/v1/auth/logout', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${logoutUserToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_api_v1_auth_logout.json', res.body);
  });

  // ─── 3. Staff Auth Endpoints Contracts ──────────────────────────────────────
  it('captures POST /api/v1/staff/auth/login/request-otp', async () => {
    await query(`UPDATE otp_requests SET created_at = NOW() - interval '2 minutes'`);
    const res = await request(app)
      .post('/api/v1/staff/auth/login/request-otp')
      .send({ email: 'employee@booyah.win' });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_staff_auth_login_request-otp.json', res.body);
  });

  it('captures POST /api/v1/staff/auth/login/verify-otp', async () => {
    const otp = testOtpStore.get('employee@booyah.win');
    const res = await request(app)
      .post('/api/v1/staff/auth/login/verify-otp')
      .send({ email: 'employee@booyah.win', otp });
    expect(res.status).toBe(200);
    employeeToken = res.body.data.token;
    saveOrVerifyContract('POST_staff_auth_login_verify-otp.json', res.body);
  });

  it('captures POST /api/v1/staff/auth/logout', async () => {
    const res = await request(app)
      .post('/api/v1/staff/auth/logout')
      .set('Authorization', `Bearer ${logoutStaffToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_staff_auth_logout.json', res.body);
  });

  // ─── 4. Staff Portal Operational Contracts ──────────────────────────────────
  it('captures GET /api/v1/staff/me', async () => {
    const res = await request(app)
      .get('/api/v1/staff/me')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_me.json', res.body);
  });

  it('captures GET /api/v1/staff/dashboard', async () => {
    const res = await request(app)
      .get('/api/v1/staff/dashboard')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_dashboard.json', res.body);
  });

  it('captures GET /api/v1/staff/entry-tiers', async () => {
    const res = await request(app)
      .get('/api/v1/staff/entry-tiers')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_entry-tiers.json', res.body);
  });

  it('captures POST /api/v1/staff/matches', async () => {
    const res = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId, startTime: '2026-12-05T12:00:00.000Z' });
    expect(res.status).toBe(201);
    saveOrVerifyContract('POST_staff_matches.json', res.body);
  });

  it('captures GET /api/v1/staff/matches', async () => {
    const res = await request(app)
      .get('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_matches.json', res.body);
  });

  // Variants: solo, duo, clash squad, and room status
  it('captures GET /api/v1/staff/matches/:id (solo variant with room)', async () => {
    const res = await request(app)
      .get(`/api/v1/staff/matches/${soloMatchId}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_matches_id__solo.json', res.body);
  });

  it('captures GET /api/v1/staff/matches/:id (duo variant with teams)', async () => {
    const res = await request(app)
      .get(`/api/v1/staff/matches/${duoMatchId}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_matches_id__duo.json', res.body);
  });

  it('captures GET /api/v1/staff/matches/:id (clash squad variant)', async () => {
    const res = await request(app)
      .get(`/api/v1/staff/matches/${csMatchId}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_matches_id__clash_squad.json', res.body);
  });

  it('captures GET /api/v1/staff/matches/:id (no room variant)', async () => {
    const res = await request(app)
      .get(`/api/v1/staff/matches/${duoMatchId}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_matches_id__no_room.json', res.body);
  });

  it('captures POST /api/v1/staff/matches/:id/open-room', async () => {
    const res = await request(app)
      .post(`/api/v1/staff/matches/${duoMatchId}/open-room`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ roomId: '887766', roomPassword: 'roomSecret123' });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_staff_matches_id_open-room.json', res.body);
  });

  it('captures POST /api/v1/staff/matches/:id/go-live', async () => {
    const res = await request(app)
      .post(`/api/v1/staff/matches/${duoMatchId}/go-live`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_staff_matches_id_go-live.json', res.body);
  });

  it('captures POST /api/v1/staff/matches/:id/cancel', async () => {
    const res = await request(app)
      .post(`/api/v1/staff/matches/${soloMatchId}/cancel`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'Room host technical network error' });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_staff_matches_id_cancel.json', res.body);
  });

  // Result variants
  it('captures POST /api/v1/staff/matches/:id/result', async () => {
    const res = await request(app)
      .post(`/api/v1/staff/matches/${rejectedMatchId}/result`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .field(
        'entries',
        JSON.stringify([
          { userId, kills: 1, position: 1 },
          { userId: user2Id, kills: 0, position: 2 },
        ])
      )
      .attach('screenshot', validPngBuffer, 'screenshot.png');
    expect(res.status).toBe(201);
    saveOrVerifyContract('POST_staff_matches_id_result.json', res.body);
  });

  it('captures GET /api/v1/staff/matches/:id/result (pending_approval variant)', async () => {
    const res = await request(app)
      .get(`/api/v1/staff/matches/${resultMatchId}/result`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_matches_id_result__pending.json', res.body);
  });

  it('captures GET /api/v1/admin/results (pending queue variant)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/results')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_admin_results__pending.json', res.body);
  });

  it('captures GET /api/v1/admin/results/:matchId/preview', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/results/${resultMatchId}/preview`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_admin_results_id_preview__normal.json', res.body);
  });

  it('captures POST /api/v1/admin/results/:matchId/approve', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/results/${resultMatchId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_admin_results_id_approve.json', res.body);
  });

  it('captures GET /api/v1/staff/matches/:id/result (approved variant)', async () => {
    const res = await request(app)
      .get(`/api/v1/staff/matches/${resultMatchId}/result`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_matches_id_result__approved.json', res.body);
  });

  it('captures POST /api/v1/admin/results/:matchId/reverse', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/results/${resultMatchId}/reverse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Score dispute approved after review' });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_admin_results_id_reverse.json', res.body);
  });

  it('captures POST /api/v1/admin/results/:matchId/reject', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/results/${rejectedMatchId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Screenshot unreadable for player kills' });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_admin_results_id_reject.json', res.body);
  });

  it('captures GET /api/v1/staff/matches/:id/result (rejected variant)', async () => {
    const res = await request(app)
      .get(`/api/v1/staff/matches/${rejectedMatchId}/result`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_matches_id_result__rejected.json', res.body);
  });

  it('captures GET /api/v1/admin/results (empty queue variant)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/results')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_admin_results__empty.json', res.body);
  });

  // Deposits & Withdrawals queues
  it('captures GET /api/v1/staff/deposits', async () => {
    const res = await request(app)
      .get('/api/v1/staff/deposits')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_deposits.json', res.body);
  });

  it('captures POST /api/v1/staff/deposits/:id/approve', async () => {
    const res = await request(app)
      .post(`/api/v1/staff/deposits/${depositId}/approve`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_staff_deposits_id_approve.json', res.body);
  });

  it('captures POST /api/v1/staff/deposits/:id/reject', async () => {
    // Create another deposit to reject
    const dep2 = await request(app)
      .post('/api/v1/wallet/deposits')
      .set('Authorization', `Bearer ${userToken}`)
      .field('amount', '30.00')
      .field('utr', '998877665544')
      .attach('screenshot', validPngBuffer, 'deposit2.png');
    const dep2Id = dep2.body.data.id;

    const res = await request(app)
      .post(`/api/v1/staff/deposits/${dep2Id}/reject`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'UTR already claimed or unverified' });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_staff_deposits_id_reject.json', res.body);
  });

  it('captures GET /api/v1/staff/withdrawals', async () => {
    const res = await request(app)
      .get('/api/v1/staff/withdrawals')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_staff_withdrawals.json', res.body);
  });

  it('captures POST /api/v1/staff/withdrawals/:id/mark-paid', async () => {
    const res = await request(app)
      .post(`/api/v1/staff/withdrawals/${withdrawalId}/mark-paid`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ payoutRef: 'REF123456789' });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_staff_withdrawals_id_mark-paid.json', res.body);
  });

  it('captures POST /api/v1/staff/withdrawals/:id/reject', async () => {
    // Create another withdrawal to reject
    const w2 = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amount: '50.00', upiId: 'player1@upi', confirm: true });
    const w2Id = w2.body.data.id;

    const res = await request(app)
      .post(`/api/v1/staff/withdrawals/${w2Id}/reject`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'Invalid or unreachable UPI ID handle' });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_staff_withdrawals_id_reject.json', res.body);
  });

  // ─── 5. User Endpoints Contracts ────────────────────────────────────────────
  it('captures GET /api/v1/me', async () => {
    const res = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_me.json', res.body);
  });

  it('captures PATCH /api/v1/me/profile', async () => {
    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${newPlayerToken}`)
      .send({ ffName: 'ProPlayerUpdated' });
    expect(res.status).toBe(200);
    saveOrVerifyContract('PATCH_api_v1_me_profile.json', res.body);
  });

  it('captures POST /api/v1/wallet/deposits', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/deposits')
      .set('Authorization', `Bearer ${userToken}`)
      .field('amount', '50.00')
      .field('utr', '112233445566')
      .attach('screenshot', validPngBuffer, 'deposit.png');
    expect(res.status).toBe(201);
    saveOrVerifyContract('POST_api_v1_wallet_deposits.json', res.body);
  });

  it('captures GET /api/v1/wallet/deposits', async () => {
    const res = await request(app)
      .get('/api/v1/wallet/deposits')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_wallet_deposits.json', res.body);
  });

  it('captures POST /api/v1/wallet/withdrawals', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amount: '50.00', upiId: 'player1@upi', confirm: true });
    expect(res.status).toBe(201);
    saveOrVerifyContract('POST_api_v1_wallet_withdrawals.json', res.body);
  });

  it('captures GET /api/v1/wallet/withdrawals', async () => {
    const res = await request(app)
      .get('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_wallet_withdrawals.json', res.body);
  });

  it('captures GET /api/v1/wallet/transactions', async () => {
    const res = await request(app)
      .get('/api/v1/wallet/transactions')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_wallet_transactions.json', res.body);
  });

  it('captures GET /api/v1/matches', async () => {
    const res = await request(app)
      .get('/api/v1/matches')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_matches.json', res.body);
  });

  it('captures GET /api/v1/matches/:id variants', async () => {
    // 1. Standard / Live / Joined variant with credentials (duoMatchId)
    const duoRes = await request(app)
      .get(`/api/v1/matches/${duoMatchId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(duoRes.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_matches_id.json', duoRes.body);
    saveOrVerifyContract('GET_api_v1_matches_id__live.json', duoRes.body);
    saveOrVerifyContract('GET_api_v1_matches_id__joined.json', duoRes.body);

    // 2. Room open variant (create a match with open room, joined by user)
    const roomMatchRes = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId, startTime: '2026-12-08T12:00:00.000Z' });
    const roomMatchId = roomMatchRes.body.data.match.id;
    await request(app)
      .post(`/api/v1/matches/${roomMatchId}/join`)
      .set('Authorization', `Bearer ${userToken}`);
    await request(app)
      .post(`/api/v1/staff/matches/${roomMatchId}/open-room`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ roomId: '776655', roomPassword: 'roomSecret123' });

    const openRoomRes = await request(app)
      .get(`/api/v1/matches/${roomMatchId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(openRoomRes.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_matches_id__room_open.json', openRoomRes.body);

    // 3. Upcoming variant (unjoined match)
    const upMatchRes = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId, startTime: '2026-12-09T12:00:00.000Z' });
    const upMatchId = upMatchRes.body.data.match.id;
    const upRes = await request(app)
      .get(`/api/v1/matches/${upMatchId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(upRes.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_matches_id__upcoming.json', upRes.body);

    // 4. Cancelled match returns 404 on getMatchUser because only active matches are queryable
    const cancelRes = await request(app)
      .get(`/api/v1/matches/${cancelledMatchId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(cancelRes.status).toBe(404);

    // 5. Full match variant (capacity 2, both seats taken)
    const fullTierRes = await query(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
       VALUES ('battle_royale', 'solo', '10.00', '5.00', 1, 2, 2)
       RETURNING id`
    );
    const fullMatchRes = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId: fullTierRes.rows[0].id.toString(), startTime: '2026-12-10T15:00:00.000Z' });
    const fullMatchId = fullMatchRes.body.data.match.id;
    await request(app)
      .post(`/api/v1/matches/${fullMatchId}/join`)
      .set('Authorization', `Bearer ${userToken}`);
    await request(app)
      .post(`/api/v1/matches/${fullMatchId}/join`)
      .set('Authorization', `Bearer ${user2Token}`);

    const fullRes = await request(app)
      .get(`/api/v1/matches/${fullMatchId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(fullRes.status).toBe(200);
    expect(fullRes.body.data.match.seatsTaken).toBe(fullRes.body.data.match.maxPlayers);
    saveOrVerifyContract('GET_api_v1_matches_id__full.json', fullRes.body);
  });

  it('captures POST /api/v1/matches/:id/join and error codes', async () => {
    // 1. Success join
    const match = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId, startTime: '2026-12-10T12:00:00.000Z' });
    const jMatchId = match.body.data.match.id;

    const res = await request(app)
      .post(`/api/v1/matches/${jMatchId}/join`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_api_v1_matches_id_join.json', res.body);

    // 2. ERROR_ALREADY_JOINED
    const dupJoinRes = await request(app)
      .post(`/api/v1/matches/${jMatchId}/join`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(dupJoinRes.status).toBe(409);
    expect(dupJoinRes.body.error.code).toBe('ALREADY_JOINED');
    saveOrVerifyContract('ERROR_ALREADY_JOINED.json', dupJoinRes.body);

    // 3. ERROR_MATCH_NOT_JOINABLE (on cancelled match)
    const closedJoinRes = await request(app)
      .post(`/api/v1/matches/${cancelledMatchId}/join`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(closedJoinRes.status).toBe(409);
    expect(closedJoinRes.body.error.code).toBe('MATCH_NOT_JOINABLE');
    saveOrVerifyContract('ERROR_MATCH_NOT_JOINABLE.json', closedJoinRes.body);

    // 4. ERROR_MATCH_FULL (on match with 1 max player)
    const singleTierRes = await query(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
       VALUES ('battle_royale', 'solo', '10.00', '5.00', 1, 1, 1)
       RETURNING id`
    );
    const fullMRes = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId: singleTierRes.rows[0].id.toString(), startTime: '2026-12-10T18:00:00.000Z' });
    const fullMId = fullMRes.body.data.match.id;
    await request(app)
      .post(`/api/v1/matches/${fullMId}/join`)
      .set('Authorization', `Bearer ${userToken}`);

    const fullJoinRes = await request(app)
      .post(`/api/v1/matches/${fullMId}/join`)
      .set('Authorization', `Bearer ${user2Token}`);
    expect(fullJoinRes.status).toBe(409);
    expect(fullJoinRes.body.error.code).toBe('MATCH_FULL');
    saveOrVerifyContract('ERROR_MATCH_FULL.json', fullJoinRes.body);

    // 5. ERROR_TEAM_INVALID (trying to create team on solo match)
    const teamInvRes = await request(app)
      .post(`/api/v1/matches/${fullMId}/teams`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ memberFfIds: ['87654321'] });
    expect(teamInvRes.status).toBe(400);
    expect(teamInvRes.body.error.code).toBe('TEAM_INVALID');
    saveOrVerifyContract('ERROR_TEAM_INVALID.json', teamInvRes.body);
  });

  it('captures team and invite endpoints with forming, confirmed, empty, pending variants', async () => {
    // 1. Empty invites variant (userToken has no pending invites)
    const emptyInvRes = await request(app)
      .get('/api/v1/me/team-invites')
      .set('Authorization', `Bearer ${userToken}`);
    expect(emptyInvRes.status).toBe(200);
    saveOrVerifyContract('GET_api_v1_me_team-invites__empty.json', emptyInvRes.body);

    // 2. Team creation (forming variant)
    const duoTierRes = await query(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
       VALUES ('battle_royale', 'duo', '20.00', '10.00', 1, 48, 2)
       RETURNING id`
    );
    const mDuoRes = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId: duoTierRes.rows[0].id.toString(), startTime: '2026-12-11T12:00:00.000Z' });
    const mDuoId = mDuoRes.body.data.match.id;

    const res = await request(app)
      .post(`/api/v1/matches/${mDuoId}/teams`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ teamName: 'Bravo Team', memberFfIds: ['87654321'] });
    expect(res.status).toBe(201);
    saveOrVerifyContract('POST_api_v1_matches_id_teams.json', res.body);
    saveOrVerifyContract('POST_api_v1_matches_id_teams__forming.json', res.body);

    // 3. Pending invites variant (for user2)
    const pendingInvRes = await request(app)
      .get('/api/v1/me/team-invites')
      .set('Authorization', `Bearer ${user2Token}`);
    expect(pendingInvRes.status).toBe(200);
    expect(pendingInvRes.body.data.invites.length).toBeGreaterThan(0);
    saveOrVerifyContract('GET_api_v1_me_team-invites.json', pendingInvRes.body);
    saveOrVerifyContract('GET_api_v1_me_team-invites__pending.json', pendingInvRes.body);

    // 4. Replace teammate invite
    const replaceRes = await request(app)
      .post(`/api/v1/matches/${mDuoId}/teams/mine/replace`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ oldFfId: '87654321', newFfId: '55667788' });
    expect(replaceRes.status).toBe(200);
    saveOrVerifyContract('POST_api_v1_matches_id_teams_mine_replace.json', replaceRes.body);

    // 5. Disband team
    const disbandRes = await request(app)
      .delete(`/api/v1/matches/${mDuoId}/teams/mine`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(disbandRes.status).toBe(200);
    saveOrVerifyContract('DELETE_api_v1_matches_id_teams_mine.json', disbandRes.body);

    // 6. Decline invite
    const mDuoDecRes = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId: duoTierId, startTime: '2026-12-11T16:00:00.000Z' });
    const mDuoDecId = mDuoDecRes.body.data.match.id;

    await request(app)
      .post(`/api/v1/matches/${mDuoDecId}/teams`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ teamName: 'Delta Team', memberFfIds: ['87654321'] });

    const decInvQuery = await query(`SELECT id FROM team_invites WHERE invited_user_id = $1 ORDER BY id DESC LIMIT 1`, [user2Id]);
    const decInviteId = decInvQuery.rows[0].id.toString();

    const decRes = await request(app)
      .post(`/api/v1/team-invites/${decInviteId}/decline`)
      .set('Authorization', `Bearer ${user2Token}`);
    expect(decRes.status).toBe(200);
    saveOrVerifyContract('POST_api_v1_team-invites_id_decline.json', decRes.body);

    // 7. Accept invite and confirm team
    const mDuoAccRes = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId: duoTierId, startTime: '2026-12-12T12:00:00.000Z' });
    const mDuoAccId = mDuoAccRes.body.data.match.id;

    await request(app)
      .post(`/api/v1/matches/${mDuoAccId}/teams`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ teamName: 'Charlie Team', memberFfIds: ['87654321'] });

    const accInvQuery = await query(`SELECT id FROM team_invites WHERE invited_user_id = $1 ORDER BY id DESC LIMIT 1`, [user2Id]);
    const accInviteId = accInvQuery.rows[0].id.toString();

    const accRes = await request(app)
      .post(`/api/v1/team-invites/${accInviteId}/accept`)
      .set('Authorization', `Bearer ${user2Token}`);
    expect(accRes.status).toBe(200);
    saveOrVerifyContract('POST_api_v1_team-invites_id_accept.json', accRes.body);
  });

  it('captures GET /api/v1/me/match-history with all status labels', async () => {
    // Seed completed matches with positions 1 (Booyah), 2 (Second), 3 (Third), 4 (4th), null (Lost)
    const labels = [
      { pos: 1, kills: 5, payout: '150.00' },
      { pos: 2, kills: 3, payout: '80.00' },
      { pos: 3, kills: 2, payout: '50.00' },
      { pos: 4, kills: 1, payout: '0.00' },
      { pos: null, kills: 0, payout: '0.00' },
    ];

    for (let i = 0; i < labels.length; i++) {
      const { pos, kills, payout } = labels[i];
      const mRes = await query(
        `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, max_players, min_players, start_time, status, created_by)
         VALUES ($1, 'battle_royale', 'solo', 20.00, 10.00, 1, '{"1":"300.00"}'::jsonb, 48, 2, '2026-11-0${i + 1}T12:00:00.000Z', 'completed', $2)
         RETURNING id`,
        [tierId, adminId]
      );
      const mId = mRes.rows[0].id;
      await query(
        `INSERT INTO match_players (match_id, user_id, paid_add_money, paid_cashback, paid_winning, position, kills, payout, joined_at)
         VALUES ($1, $2, 20.00, 0.00, 0.00, $3, $4, $5, NOW())`,
        [mId, userId, pos, kills, payout]
      );
    }

    const res = await request(app)
      .get('/api/v1/me/match-history')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);

    const posLabels = res.body.data.items.map((it: any) => it.positionLabel);
    expect(posLabels).toContain('Booyah');
    expect(posLabels).toContain('Second');
    expect(posLabels).toContain('Third');
    expect(posLabels).toContain('4th');
    expect(posLabels).toContain('Lost');
    expect(posLabels).toContain('Result pending');
    expect(posLabels).toContain('Cancelled (refunded)');

    saveOrVerifyContract('GET_api_v1_me_match-history.json', res.body);
  });

  // ─── 6. Error Envelopes Contracts ───────────────────────────────────────────
  it('captures ERROR_LOW_BALANCE with affectedUsers details', async () => {
    // 1. Setup a completed match with approved result
    const createMatch = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId, startTime: '2026-12-03T10:00:00.000Z' });
    const revMatchId = createMatch.body.data.match.id;

    await request(app)
      .post(`/api/v1/matches/${revMatchId}/join`)
      .set('Authorization', `Bearer ${userToken}`);
    await request(app)
      .post(`/api/v1/matches/${revMatchId}/join`)
      .set('Authorization', `Bearer ${user2Token}`);

    await request(app)
      .post(`/api/v1/staff/matches/${revMatchId}/open-room`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ roomId: '112233', roomPassword: 'roomSecret123' });

    await request(app)
      .post(`/api/v1/staff/matches/${revMatchId}/go-live`)
      .set('Authorization', `Bearer ${adminToken}`);

    await request(app)
      .post(`/api/v1/staff/matches/${revMatchId}/result`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .field(
        'entries',
        JSON.stringify([
          { userId, kills: 1, position: 1 },
          { userId: user2Id, kills: 0, position: 2 },
        ])
      )
      .attach('screenshot', validPngBuffer, 'screenshot.png');

    await request(app)
      .post(`/api/v1/admin/results/${revMatchId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Drain player winning balance to 0 so reversal fails with LOW_BALANCE
    await query(`UPDATE wallets SET winning = 0.00 WHERE user_id = $1`, [userId]);

    const res = await request(app)
      .post(`/api/v1/admin/results/${revMatchId}/reverse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Reversal test for low balance' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LOW_BALANCE');
    saveOrVerifyContract('ERROR_LOW_BALANCE.json', res.body);
  });

  // ─── 5.5 Admin Management Endpoints Contracts ──────────────────────────
  let adminCreatedEmployeeId: string;
  let adminCreatedTierId: string;
  let dummyDeleteUserId: string;

  it('captures POST /api/v1/admin/employees', async () => {
    const res = await request(app)
      .post('/api/v1/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Contract Staff',
        email: 'contract_staff@booyah.win',
        mobile: '9998881234',
        pan: 'ABCDE1234F',
        aadhaar: '123456789012',
      });
    expect(res.status).toBe(201);
    adminCreatedEmployeeId = res.body.data.employee.id;
    saveOrVerifyContract('POST_admin_employees.json', res.body);
  });

  it('captures GET /api/v1/admin/employees', async () => {
    const res = await request(app)
      .get('/api/v1/admin/employees?q=Contract')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_admin_employees.json', res.body);
  });

  it('captures PATCH /api/v1/admin/employees/:id', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/employees/${adminCreatedEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Contract Staff Updated',
      });
    expect(res.status).toBe(200);
    saveOrVerifyContract('PATCH_admin_employees_id.json', res.body);
  });

  it('captures DELETE /api/v1/admin/employees/:id', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/employees/${adminCreatedEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('DELETE_admin_employees_id.json', res.body);
  });

  it('captures POST /api/v1/admin/tiers', async () => {
    const res = await request(app)
      .post('/api/v1/admin/tiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gameMode: 'battle_royale',
        teamMode: 'squad',
        entryFee: '25.00',
        killPrice: '10.00',
        minKillsForReward: 2,
        maxPlayers: 48,
        minPlayers: 24,
        positions: [
          { position: 1, prize: '100.00' },
          { position: 2, prize: '50.00' },
        ],
      });
    expect(res.status).toBe(201);
    adminCreatedTierId = res.body.data.tier.id;
    saveOrVerifyContract('POST_admin_tiers.json', res.body);
  });

  it('captures GET /api/v1/admin/tiers', async () => {
    const res = await request(app)
      .get('/api/v1/admin/tiers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_admin_tiers.json', res.body);
  });

  it('captures PATCH /api/v1/admin/tiers/:id', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/tiers/${adminCreatedTierId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        killPrice: '12.00',
      });
    expect(res.status).toBe(200);
    saveOrVerifyContract('PATCH_admin_tiers_id.json', res.body);
  });

  it('captures DELETE /api/v1/admin/tiers/:id', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/tiers/${adminCreatedTierId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('DELETE_admin_tiers_id.json', res.body);
  });

  it('captures GET /api/v1/admin/users', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users?q=Player')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_admin_users.json', res.body);
  });

  it('captures GET /api/v1/admin/users/:id', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_admin_users_id.json', res.body);
  });

  it('captures POST /api/v1/admin/users/:id/adjust', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/users/${userId}/adjust`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        wallet: 'winning',
        amount: '20.00',
        reason: 'Tournament bonus reward',
      });
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_admin_users_id_adjust.json', res.body);
  });

  it('captures DELETE /api/v1/admin/users/:id', async () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const dummyUserRes = await query(
      `INSERT INTO users (name, email, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
       VALUES ('Dummy Delete User', $1, $2, $3, 'DummyDel', 'dummy@upi', '2000-01-01', $4)
       RETURNING id`,
      [`dummy_del_${rand}@example.com`, `98765${rand}1`, `FF_DEL_${rand}`, `REFD${rand}`]
    );
    dummyDeleteUserId = dummyUserRes.rows[0].id.toString();
    await query(`INSERT INTO wallets (user_id) VALUES ($1)`, [dummyDeleteUserId]);

    const res = await request(app)
      .delete(`/api/v1/admin/users/${dummyDeleteUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Terms of service violation',
      });
    expect(res.status).toBe(200);
    saveOrVerifyContract('DELETE_admin_users_id.json', res.body);
  });

  it('captures GET /api/v1/admin/settings', async () => {
    const res = await request(app)
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_admin_settings.json', res.body);
  });

  it('captures PATCH /api/v1/admin/settings', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        min_deposit: '15.00',
        max_deposit: '6000.00',
        support_name: 'Booyah Support Team',
      });
    expect(res.status).toBe(200);
    saveOrVerifyContract('PATCH_admin_settings.json', res.body);
  });

  it('captures POST /api/v1/admin/settings/payment-qr', async () => {
    const res = await request(app)
      .post('/api/v1/admin/settings/payment-qr')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', validPngBuffer, 'qr.png');
    expect(res.status).toBe(200);
    saveOrVerifyContract('POST_admin_settings_payment-qr.json', res.body);
  });

  it('captures GET /api/v1/admin/audit-logs', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs?limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    saveOrVerifyContract('GET_admin_audit-logs.json', res.body);
  });

  it('captures ERROR_FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/admin/results/999/approve')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
    saveOrVerifyContract('ERROR_FORBIDDEN.json', res.body);
  });

  it('captures ERROR_UNAUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/staff/me');
    expect(res.status).toBe(401);
    saveOrVerifyContract('ERROR_UNAUTHENTICATED.json', res.body);
  });

  it('captures ERROR_NOT_FOUND', async () => {
    const res = await request(app)
      .get('/api/v1/staff/matches/999999')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(404);
    saveOrVerifyContract('ERROR_NOT_FOUND.json', res.body);
  });

  it('captures ERROR_VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/staff/matches')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ tierId: 'invalid-tier' });
    expect(res.status).toBe(400);
    saveOrVerifyContract('ERROR_VALIDATION_ERROR.json', res.body);
  });

  it('captures ERROR_INVALID_TRANSITION', async () => {
    const res = await request(app)
      .post(`/api/v1/staff/matches/${cancelledMatchId}/cancel`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'Already cancelled match' });
    expect(res.status).toBe(409);
    saveOrVerifyContract('ERROR_INVALID_TRANSITION.json', res.body);
  });

  // ─── 7. Dynamic Manifest Audit ──────────────────────────────────────────────
  it('fails if any frontend-used endpoint has no captured contract', () => {
    const frontendEndpoints = getFrontendEndpoints();
    expect(frontendEndpoints.length).toBeGreaterThan(0);

    const contractFiles = fs.readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith('.json'));

    const missingEndpoints: string[] = [];
    for (const ep of frontendEndpoints) {
      const cleanPath = ep.path
        .replace(/^\//, '')
        .replace(/\//g, '_')
        .replace(/:(id|matchid)/g, 'id');
      const normalizedEp = `${ep.method}_${cleanPath}`.toLowerCase();

      const matched = contractFiles.some((f) => {
        const normFile = f
          .toLowerCase()
          .replace(/\.json$/, '')
          .replace(/_matchid_/g, '_id_')
          .replace(/_api_v1_/g, '_');
        return (
          normFile === normalizedEp ||
          normFile.startsWith(`${normalizedEp}__`) ||
          normFile.startsWith(`${normalizedEp}_`) ||
          normFile.includes(normalizedEp)
        );
      });

      if (!matched) {
        missingEndpoints.push(`${ep.method} ${ep.path} (called by ${ep.source})`);
      }
    }

    expect(
      missingEndpoints,
      `Frontend calls the following endpoints that have no captured contract in docs/contracts/:\n${missingEndpoints.join('\n')}`
    ).toEqual([]);
  });

  // ─── 8. Fake Data Security Audit ────────────────────────────────────────────
  it('fails if any contract file contains real-looking tokens, non-placeholder emails, or long hex strings', () => {
    const contractFiles = fs.readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith('.json'));
    expect(contractFiles.length).toBeGreaterThan(0);

    const allowedEmails = new Set(['user@example.com', 'staff@booyah.win', 'support@booyahwin.com']);
    const violations: string[] = [];

    for (const file of contractFiles) {
      const fullPath = path.join(CONTRACTS_DIR, file);
      const rawText = fs.readFileSync(fullPath, 'utf-8');

      // Check for real JWT token
      if (/ey[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/.test(rawText)) {
        violations.push(`${file}: contains real-looking JWT token`);
      }

      // Check for long hex string (32+ chars)
      if (/[0-9a-fA-F]{32,}/.test(rawText)) {
        violations.push(`${file}: contains long hex string (>= 32 chars)`);
      }

      // Check emails
      const emailMatches = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const email of emailMatches) {
        if (!allowedEmails.has(email)) {
          violations.push(`${file}: contains unapproved email "${email}"`);
        }
      }

      // Check test environment secrets
      if (process.env.TEST_DATABASE_URL && rawText.includes(process.env.TEST_DATABASE_URL)) {
        violations.push(`${file}: contains TEST_DATABASE_URL from test environment`);
      }
    }

    expect(
      violations,
      `Contract files must contain only fake data placeholders. Found violations:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});
