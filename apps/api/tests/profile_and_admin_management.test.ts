import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import {
  ErrorCodes,
  getOrdinal,
  getPositionLabel,
  stringToPaise,
  paiseToString,
} from '@booyah/shared';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { SettingsService } from '../src/modules/admin/settings/settings.service.js';

const app = createApp({ enableRateLimiting: false });

// Minimal valid JPEG buffer (magic bytes 0xff, 0xd8, 0xff, 0xe0)
const VALID_JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(200),
]);

let _counter = 0;
const nextId = () => ++_counter;

interface TestUser {
  id: string;
  email: string;
  name: string;
  mobile: string;
  ffId: string;
  ffName: string;
  upiId: string;
}

interface TestStaff {
  id: string;
  email: string;
  role: 'admin' | 'employee';
}

async function createTier(gameMode = 'battle_royale', teamMode = 'solo'): Promise<string> {
  const i = nextId();
  const res = await query(
    `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
     VALUES ($1, $2, 10.00, 5.00, 2, 48, 24)
     RETURNING id`,
    [gameMode, teamMode]
  );
  return res.rows[0].id.toString();
}

async function createTestUser(overrides: Partial<TestUser> = {}): Promise<{ user: TestUser; token: string }> {
  const i = nextId();
  const mobile = overrides.mobile ?? '9' + String(i).padStart(9, '0');
  const email = overrides.email ?? `user${i}@example.com`;
  const name = overrides.name ?? `Player ${i}`;
  const ffId = overrides.ffId ?? `${100000 + i}`;
  const ffName = overrides.ffName ?? `FFPlayer${i}`;
  const upiId = overrides.upiId ?? `player${i}@upi`;

  const res = await query(
    `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
     VALUES ($1, $2, $3, $4, $5, $6, '1995-05-15', $7)
     RETURNING id, email, name, mobile, ff_id, ff_name, upi_id`,
    [email, name, mobile, ffId, ffName, upiId, `REF${String(i).padStart(5, '0')}`]
  );
  const row = res.rows[0];
  const user: TestUser = {
    id: row.id.toString(),
    email: row.email,
    name: row.name,
    mobile: row.mobile,
    ffId: row.ff_id,
    ffName: row.ff_name,
    upiId: row.upi_id,
  };

  await query('INSERT INTO wallets (user_id) VALUES ($1)', [user.id]);

  const sid = crypto.randomUUID();
  await query(
    `INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`,
    [sid, user.id]
  );
  const token = signSessionToken({ sub: user.id, typ: 'user', sid }, '1h');
  return { user, token };
}

async function createTestStaff(role: 'admin' | 'employee' = 'employee'): Promise<{ staff: TestStaff; token: string }> {
  const i = nextId();
  const res = await query(
    `INSERT INTO staff (role, name, email, mobile)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, role`,
    [role, `Staff ${i}`, `staff_${i}@booyah.win`, '8' + String(i).padStart(9, '0')]
  );
  const row = res.rows[0];
  const staff: TestStaff = {
    id: row.id.toString(),
    email: row.email,
    role: row.role,
  };

  const sid = crypto.randomUUID();
  await query(
    `INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`,
    [sid, staff.id]
  );
  const token = signSessionToken(
    { sub: staff.id, typ: 'staff', sid, role: staff.role },
    '12h'
  );
  return { staff, token };
}

let _defaultStaffId: string | null = null;
async function getDefaultStaffId(): Promise<string> {
  if (!_defaultStaffId) {
    const { staff } = await createTestStaff('admin');
    _defaultStaffId = staff.id;
  }
  return _defaultStaffId;
}

describe('Milestone 8: History, Profile, Staff Dashboard & Admin Management', () => {
  beforeEach(async () => {
    _defaultStaffId = null;
    await truncateAllTables();
    await SettingsService.seedDefaults();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Position Ordinal Function Tests (Requirement 3)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Requirement 3: Ordinal position formatting', () => {
    it('formats numbers with correct English ordinals beyond Booyah/Second/Third', () => {
      expect(getOrdinal(1)).toBe('1st');
      expect(getOrdinal(2)).toBe('2nd');
      expect(getOrdinal(3)).toBe('3rd');
      expect(getOrdinal(4)).toBe('4th');
      expect(getOrdinal(11)).toBe('11th');
      expect(getOrdinal(12)).toBe('12th');
      expect(getOrdinal(13)).toBe('13th');
      expect(getOrdinal(21)).toBe('21st');
      expect(getOrdinal(22)).toBe('22nd');
      expect(getOrdinal(23)).toBe('23rd');
      expect(getOrdinal(101)).toBe('101st');
      expect(getOrdinal(111)).toBe('111th');
      expect(getOrdinal(112)).toBe('112th');
      expect(getOrdinal(113)).toBe('113th');
    });

    it('maps position to labels: Booyah, Second, Third, 4th, 11th, 21st, Lost', () => {
      // Battle Royale
      expect(getPositionLabel(1, 'battle_royale')).toBe('Booyah');
      expect(getPositionLabel(2, 'battle_royale')).toBe('Second');
      expect(getPositionLabel(3, 'battle_royale')).toBe('Third');
      expect(getPositionLabel(4, 'battle_royale')).toBe('4th');
      expect(getPositionLabel(11, 'battle_royale')).toBe('11th');
      expect(getPositionLabel(12, 'battle_royale')).toBe('12th');
      expect(getPositionLabel(13, 'battle_royale')).toBe('13th');
      expect(getPositionLabel(21, 'battle_royale')).toBe('21st');
      expect(getPositionLabel(22, 'battle_royale')).toBe('22nd');
      expect(getPositionLabel(23, 'battle_royale')).toBe('23rd');
      expect(getPositionLabel(null, 'battle_royale')).toBe('Lost');
      expect(getPositionLabel(undefined, 'battle_royale')).toBe('Lost');

      // Clash Squad
      expect(getPositionLabel(1, 'clash_squad')).toBe('Booyah');
      expect(getPositionLabel(2, 'clash_squad')).toBe('Lost');
      expect(getPositionLabel(null, 'clash_squad')).toBe('Lost');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Profile Management & 30-Day Cooldowns (Section 9, Requirements 4 & 9)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Profile & Cooldowns (Section 9 & Requirement 9)', () => {
    it('GET /me returns user profile, wallet balances, and cooldown fields', async () => {
      const { user, token } = await createTestUser();

      const res = await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.profile.email).toBe(user.email);
      expect(res.body.data.profile.name).toBe(user.name);
      expect(res.body.data.wallets).toEqual({
        addMoney: '0.00',
        cashback: '0.00',
        winning: '0.00',
        total: '0.00',
      });
      expect(res.body.data.cooldowns).toBeDefined();
      expect(res.body.data.cooldowns.mobileAvailableAt).toBeNull();
      expect(res.body.data.cooldowns.ffIdAvailableAt).toBeNull();
      expect(res.body.data.cooldowns.ffNameAvailableAt).toBeNull();
      expect(res.body.data.cooldowns.upiIdAvailableAt).toBeNull();
    });

    it('rejects updates to non-editable fields (name, email, referralCode) with 400 VALIDATION_ERROR', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Name' })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('first edit succeeds and sets *_changed_at in database', async () => {
      const { user, token } = await createTestUser();

      const newFfName = 'ProSniper99';
      const res = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ ffName: newFfName })
        .expect(200);

      expect(res.body.data.profile.ffName).toBe(newFfName);

      const dbCheck = await query(
        'SELECT ff_name, ff_name_changed_at FROM users WHERE id = $1',
        [user.id]
      );
      expect(dbCheck.rows[0].ff_name).toBe(newFfName);
      expect(dbCheck.rows[0].ff_name_changed_at).not.toBeNull();
    });

    it('unchanged field values are ignored and do not reset cooldown', async () => {
      const { user, token } = await createTestUser();

      // Submit identical ffName
      const res = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ ffName: user.ffName })
        .expect(200);

      expect(res.body.data.profile.ffName).toBe(user.ffName);

      const dbCheck = await query(
        'SELECT ff_name_changed_at FROM users WHERE id = $1',
        [user.id]
      );
      expect(dbCheck.rows[0].ff_name_changed_at).toBeNull();
    });

    it('cooldown rejects edit 29 days back (429 FIELD_COOLDOWN) and allows exactly 30 days back (Requirement 9)', async () => {
      const { user, token } = await createTestUser();

      // Set mobile_changed_at to 29 days in the past using database clock
      await query(
        "UPDATE users SET mobile_changed_at = now() - INTERVAL '29 days' WHERE id = $1",
        [user.id]
      );

      // Attempting to change mobile now should fail with FIELD_COOLDOWN
      const failRes = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ mobile: '9876543210' })
        .expect(429);

      expect(failRes.body.error.code).toBe(ErrorCodes.FIELD_COOLDOWN);
      expect(failRes.body.error.details).toBeDefined();
      expect(failRes.body.error.details.field).toBe('mobile');
      expect(failRes.body.error.details.availableAt).toBeDefined();

      // Set mobile_changed_at to exactly 30 days in the past using database clock
      await query(
        "UPDATE users SET mobile_changed_at = now() - INTERVAL '30 days' WHERE id = $1",
        [user.id]
      );

      // Attempting to change mobile now must SUCCEED
      const okRes = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ mobile: '9876543210' })
        .expect(200);

      expect(okRes.body.data.profile.mobile).toBe('9876543210');
    });

    it('blocks FF ID and FF Name changes when user is in an active match (409 IN_ACTIVE_MATCH)', async () => {
      const { user, token } = await createTestUser();

      // Insert active match and match_players entry
      const staffId = await getDefaultStaffId();
      const tierId = await createTier('battle_royale', 'solo');
      const matchRes = await query(
        `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
                              max_players, min_players, position_prizes, status, start_time, created_by)
         VALUES ($1, 'battle_royale', 'solo', 10.00, 5.00, 2, 48, 24, '{"1": 50}', 'live', now() + INTERVAL '1 hour', $2)
         RETURNING id`,
        [tierId, staffId]
      );
      const matchId = matchRes.rows[0].id;
      await query(
        `INSERT INTO match_players (match_id, user_id, paid_add_money) VALUES ($1, $2, 10.00)`,
        [matchId, user.id]
      );

      // Attempt to change ffId
      const ffIdRes = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ ffId: '999888777' })
        .expect(409);

      expect(ffIdRes.body.error.code).toBe(ErrorCodes.IN_ACTIVE_MATCH);

      // Attempt to change ffName
      const ffNameRes = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ ffName: 'NewNameWhileActive' })
        .expect(409);

      expect(ffNameRes.body.error.code).toBe(ErrorCodes.IN_ACTIVE_MATCH);

      // Cancel match (refund player)
      await query("UPDATE match_players SET refunded_at = now() WHERE match_id = $1", [matchId]);
      await query("UPDATE matches SET status = 'cancelled' WHERE id = $1", [matchId]);

      // Now ffName change succeeds!
      const okRes = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ ffName: 'ValidNowAfterCancel' })
        .expect(200);

      expect(okRes.body.data.profile.ffName).toBe('ValidNowAfterCancel');
    });

    it('UPI ID change triggers the 48-hour withdrawal lock (403 UPI_RECENTLY_CHANGED)', async () => {
      const { user, token } = await createTestUser();

      // Credit winning wallet with 100 Rs
      await query("UPDATE wallets SET winning = 100.00 WHERE user_id = $1", [user.id]);

      // Change UPI ID
      const newUpi = 'newupi_address@okaxis';
      await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ upiId: newUpi })
        .expect(200);

      // Attempt withdrawal immediately with new UPI ID
      const wthRes = await request(app)
        .post('/api/v1/wallet/withdrawals')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: '50.00', upiId: newUpi, confirm: true })
        .expect(403);

      expect(wthRes.body.error.code).toBe(ErrorCodes.UPI_RECENTLY_CHANGED);
    });

    it('rejects duplicate mobile, ffId, and upiId (409)', async () => {
      const { user: u1 } = await createTestUser({
        mobile: '9111111111',
        ffId: '111222333',
        upiId: 'u1@upi',
      });
      const { token: t2 } = await createTestUser();

      // Duplicate mobile
      const dupMobile = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${t2}`)
        .send({ mobile: u1.mobile })
        .expect(409);
      expect(dupMobile.body.error.code).toBe(ErrorCodes.MOBILE_EXISTS);

      // Duplicate ffId
      const dupFfId = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${t2}`)
        .send({ ffId: u1.ffId })
        .expect(409);
      expect(dupFfId.body.error.code).toBe(ErrorCodes.FF_ID_EXISTS);

      // Duplicate upiId (case-insensitive)
      const dupUpi = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${t2}`)
        .send({ upiId: 'U1@UPI' })
        .expect(409);
      expect(dupUpi.body.error.code).toBe(ErrorCodes.UPI_EXISTS);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Profile Rate Limiting (Requirement 7)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Requirement 7: Rate limit PATCH /me/profile to 10/min per user', () => {
    it('enforces 10 requests/min per user limit when rate limiting is enabled', async () => {
      const rateLimitedApp = createApp({ enableRateLimiting: true });
      const { token } = await createTestUser();

      // Perform 10 requests (all allowed)
      for (let i = 0; i < 10; i++) {
        // Send empty body or valid request
        await request(rateLimitedApp)
          .patch('/api/v1/me/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({})
          .expect(200);
      }

      // 11th request must be RATE_LIMITED (429)
      const res = await request(rateLimitedApp)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(429);

      expect(res.body.error.code).toBe(ErrorCodes.RATE_LIMITED);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. User Match History (Section 13.2)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Match History (Section 13.2)', () => {
    it('returns match history with kills, ordinal position labels, and pagination', async () => {
      const { user, token } = await createTestUser();

      // Create a completed Battle Royale match
      const staffId = await getDefaultStaffId();
      const t1 = await createTier('battle_royale', 'solo');
      const m1 = await query(
        `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
                              max_players, min_players, position_prizes, status, start_time, created_by)
         VALUES ($1, 'battle_royale', 'solo', 10.00, 5.00, 2, 48, 24, '{"1": 50, "4": 20}', 'completed', now() - INTERVAL '2 hours', $2)
         RETURNING id`,
        [t1, staffId]
      );
      const m1Id = m1.rows[0].id;
      await query(
        `INSERT INTO match_players (match_id, user_id, kills, position, payout, paid_add_money)
         VALUES ($1, $2, 4, 4, 30.00, 10.00)`,
        [m1Id, user.id]
      );

      // Create a cancelled match
      const t2 = await createTier('battle_royale', 'solo');
      const m2 = await query(
        `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
                              max_players, min_players, position_prizes, status, start_time, created_by)
         VALUES ($1, 'battle_royale', 'solo', 20.00, 10.00, 2, 48, 24, '{"1": 100}', 'cancelled', now() - INTERVAL '1 hour', $2)
         RETURNING id`,
        [t2, staffId]
      );
      const m2Id = m2.rows[0].id;
      await query(
        `INSERT INTO match_players (match_id, user_id, paid_add_money, refunded_at)
         VALUES ($1, $2, 20.00, now())`,
        [m2Id, user.id]
      );

      // Create a live match (result pending)
      const t3 = await createTier('clash_squad', 'squad');
      const m3 = await query(
        `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
                              max_players, min_players, position_prizes, status, start_time, created_by)
         VALUES ($1, 'clash_squad', 'squad', 50.00, 0.00, 0, 8, 8, '{"1": 75}', 'live', now(), $2)
         RETURNING id`,
        [t3, staffId]
      );
      const m3Id = m3.rows[0].id;
      await query(
        `INSERT INTO match_players (match_id, user_id, paid_add_money)
         VALUES ($1, $2, 50.00)`,
        [m3Id, user.id]
      );

      // Fetch history
      const res = await request(app)
        .get('/api/v1/me/match-history')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.items).toHaveLength(3);

      // m3 is live -> displayStatus 'Result pending'
      const itemLive = res.body.data.items.find((x: any) => x.matchId === m3Id.toString());
      expect(itemLive.displayStatus).toBe('Result pending');

      // m2 is cancelled -> displayStatus 'Cancelled (refunded)'
      const itemCancelled = res.body.data.items.find((x: any) => x.matchId === m2Id.toString());
      expect(itemCancelled.displayStatus).toBe('Cancelled (refunded)');

      // m1 is completed with position 4 -> displayStatus '4th'
      const itemCompleted = res.body.data.items.find((x: any) => x.matchId === m1Id.toString());
      expect(itemCompleted.displayStatus).toBe('4th');
      expect(itemCompleted.kills).toBe(4);
      expect(itemCompleted.payout).toBe('30.00');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Staff Dashboard & Results Queue Filter (Section 15 & Requirement 8)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Staff Dashboard & Results Queue (Section 15 & Requirement 8)', () => {
    it('GET /staff/dashboard returns counts and filters resultsWaitingApproval only for live matches', async () => {
      const { staff: employee, token: empToken } = await createTestStaff('employee');
      const { staff: admin, token: adminToken } = await createTestStaff('admin');
      const { user } = await createTestUser();

      // 1. Pending deposit older than 35 minutes
      await query(
        `INSERT INTO deposit_requests (user_id, amount, utr, screenshot_url, status, created_at)
         VALUES ($1, 100.00, 'UTR12345678', 's.jpg', 'pending', now() - INTERVAL '35 minutes')`,
        [user.id]
      );

      // 2. Pending withdrawal created 10 minutes ago
      await query(
        `INSERT INTO withdrawal_requests (user_id, amount, upi_id, status, created_at)
         VALUES ($1, 50.00, 'u@upi', 'pending', now() - INTERVAL '10 minutes')`,
        [user.id]
      );

      // 3. Match 1: LIVE with pending_approval result
      const staffId = await getDefaultStaffId();
      const tLive = await createTier('battle_royale', 'solo');
      const liveMatch = await query(
        `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
                              max_players, min_players, position_prizes, status, start_time, created_by)
         VALUES ($1, 'battle_royale', 'solo', 10.00, 5.00, 2, 48, 24, '{"1": 50}', 'live', now(), $2)
         RETURNING id`,
        [tLive, staffId]
      );
      const liveId = liveMatch.rows[0].id;
      await query(
        `INSERT INTO match_results (match_id, entries, screenshot_url, status, submitted_by)
         VALUES ($1, '[]', 'proof.jpg', 'pending_approval', $2)`,
        [liveId, employee.id]
      );

      // 4. Match 2: COMPLETED (or CANCELLED) with a pending_approval result (e.g. stale row)
      const tCancelled = await createTier('battle_royale', 'solo');
      const cancelledMatch = await query(
        `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
                              max_players, min_players, position_prizes, status, start_time, created_by)
         VALUES ($1, 'battle_royale', 'solo', 10.00, 5.00, 2, 48, 24, '{"1": 50}', 'cancelled', now(), $2)
         RETURNING id`,
        [tCancelled, staffId]
      );
      const cancelledId = cancelledMatch.rows[0].id;
      await query(
        `INSERT INTO match_results (match_id, entries, screenshot_url, status, submitted_by)
         VALUES ($1, '[]', 'proof2.jpg', 'pending_approval', $2)`,
        [cancelledId, employee.id]
      );

      // Check Dashboard as employee
      const res = await request(app)
        .get('/api/v1/staff/dashboard')
        .set('Authorization', `Bearer ${empToken}`)
        .expect(200);

      const d = res.body.data;
      expect(d.pendingDepositsCount).toBe(1);
      expect(d.isOldestDepositOver30Min).toBe(true);
      expect(d.pendingWithdrawalsCount).toBe(1);
      expect(d.liveMatchesCount).toBe(1);
      // Requirement 8: counts ONLY pending results whose match is LIVE (Match 1, not Match 2)
      expect(d.resultsWaitingApprovalCount).toBe(1);

      // Check admin results queue (Requirement 8)
      const qRes = await request(app)
        .get('/api/v1/admin/results')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(qRes.body.data.count).toBe(1);
      expect(qRes.body.data.results[0].matchId).toBe(liveId.toString());
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Payment QR Upload & Settings Key (Section 16.5 & Requirement 2)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Payment QR Upload & payment_qr_key Setting (Requirement 2)', () => {
    it('PATCH /admin/settings rejects payment_qr_key with 400 VALIDATION_ERROR', async () => {
      const { token: adminToken } = await createTestStaff('admin');

      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_qr_key: 'fake_key.jpg' })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('GET /payment-info returns "not configured" when payment_upi_id is empty', async () => {
      // Ensure payment_upi_id is empty
      await query("UPDATE app_settings SET value = '' WHERE key = 'payment_upi_id'");

      const res = await request(app)
        .get('/api/v1/payment-info')
        .expect(200);

      expect(res.body.data.configured).toBe(false);
      expect(res.body.data.message).toBe('Payment information not configured yet');
      expect(res.body.data.paymentUpiId).toBeNull();
      expect(res.body.data.qrUrl).toBeNull();
    });

    it('POST /admin/settings/payment-qr uploads image and writes payment_qr_key', async () => {
      const { token: adminToken } = await createTestStaff('admin');

      const uploadRes = await request(app)
        .post('/api/v1/admin/settings/payment-qr')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('qr', VALID_JPEG, 'qr_code.jpg')
        .expect(200);

      expect(uploadRes.body.data.paymentQrKey).toBeDefined();
      expect(uploadRes.body.data.qrUrl).toBeDefined();

      const newKey = uploadRes.body.data.paymentQrKey;

      // Verify app_settings in database
      const dbCheck = await query(
        "SELECT value FROM app_settings WHERE key = 'payment_qr_key'"
      );
      expect(dbCheck.rows[0].value).toBe(newKey);

      // Now configure UPI ID
      await query(
        "UPDATE app_settings SET value = 'booyahwin@upi' WHERE key = 'payment_upi_id'"
      );

      // GET /payment-info now returns configured: true and signed qrUrl
      const infoRes = await request(app)
        .get('/api/v1/payment-info')
        .expect(200);

      expect(infoRes.body.data.configured).toBe(true);
      expect(infoRes.body.data.paymentUpiId).toBe('booyahwin@upi');
      expect(infoRes.body.data.qrUrl).toContain('/api/v1/files/');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Admin User Management (Section 16.3, Requirements 1, 4, 5, 6)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Admin User Management (Section 16.3 & Requirements 1, 4, 5, 6)', () => {
    it('escapes % and _ in search and includes deleted users with flag (Requirement 5)', async () => {
      const { staff: admin, token: adminToken } = await createTestStaff('admin');

      // Create users with literal % and _ in name or email
      const { user: u1 } = await createTestUser({ name: 'Special_User', email: 'special@example.com' });
      const { user: u2 } = await createTestUser({ name: 'Percent%User', email: 'percent@example.com' });
      const { user: u3 } = await createTestUser({ name: 'Normal User', email: 'normal@example.com' });
      const { user: u4 } = await createTestUser({ name: 'Deleted User', email: 'deleted@example.com' });

      // Soft delete u4
      await query("UPDATE users SET deleted_at = now() WHERE id = $1", [u4.id]);

      // Search for literal '_'
      const searchUnder = await request(app)
        .get('/api/v1/admin/users?q=_')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const underIds = searchUnder.body.data.items.map((x: any) => x.id);
      expect(underIds).toContain(u1.id);
      expect(underIds).not.toContain(u2.id);
      expect(underIds).not.toContain(u3.id);

      // Search for literal '%'
      const searchPercent = await request(app)
        .get('/api/v1/admin/users?q=%')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const pctIds = searchPercent.body.data.items.map((x: any) => x.id);
      expect(pctIds).toContain(u2.id);
      expect(pctIds).not.toContain(u1.id);
      expect(pctIds).not.toContain(u3.id);

      // Search includes deleted users with isDeleted flag
      const searchDel = await request(app)
        .get('/api/v1/admin/users?q=Deleted')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(searchDel.body.data.items[0].id).toBe(u4.id);
      expect(searchDel.body.data.items[0].isDeleted).toBe(true);
    });

    it('soft deletes user, invalidates session, expires invites, and 409s on already deleted (Requirement 6)', async () => {
      const { staff: admin, token: adminToken } = await createTestStaff('admin');
      const { user, token: userToken } = await createTestUser();

      // Create pending team invite for user
      const tTeam = await createTier('battle_royale', 'duo');
      const teamRes = await query(
        `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
                              max_players, min_players, position_prizes, status, start_time, created_by)
         VALUES ($1, 'battle_royale', 'duo', 10.00, 5.00, 2, 48, 24, '{"1": 50}', 'upcoming', now() + INTERVAL '1 hour', $2)
         RETURNING id`,
        [tTeam, admin.id]
      );
      const matchId = teamRes.rows[0].id;
      const tRes = await query(
        `INSERT INTO teams (match_id, leader_id, name, size, status)
         VALUES ($1, $2, 'Alpha', 2, 'forming') RETURNING id`,
        [matchId, user.id]
      );
      const teamId = tRes.rows[0].id;
      await query(
        `INSERT INTO team_invites (team_id, invited_user_id, status)
         VALUES ($1, $2, 'pending')`,
        [teamId, user.id]
      );

      // Delete user
      const delRes = await request(app)
        .delete(`/api/v1/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Cheating in tournament' })
        .expect(200);

      expect(delRes.body.data.message).toBe('User deleted successfully');

      // Requirement 6: Deleting an already-deleted user returns 409 INVALID_TRANSITION
      const secondDel = await request(app)
        .delete(`/api/v1/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Try deleting again' })
        .expect(409);

      expect(secondDel.body.error.code).toBe(ErrorCodes.INVALID_TRANSITION);

      // User session is killed: making user requests with previous token returns 401
      await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);

      // Team invites for user are marked expired
      const invCheck = await query(
        'SELECT status FROM team_invites WHERE invited_user_id = $1',
        [user.id]
      );
      expect(invCheck.rows[0].status).toBe('expired');
    });

    it('admin adjustment credits and debits via wallet.service and rejects zero/low balance (Requirement 1)', async () => {
      const { staff: admin, token: adminToken } = await createTestStaff('admin');
      const { user } = await createTestUser();

      // Zero amount is rejected
      const zeroRes = await request(app)
        .post(`/api/v1/admin/users/${user.id}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ wallet: 'add_money', amount: '0.00', reason: 'Zero test' })
        .expect(400);
      expect(zeroRes.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // Reason < 5 chars is rejected
      const shortReasonRes = await request(app)
        .post(`/api/v1/admin/users/${user.id}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ wallet: 'add_money', amount: '50.00', reason: 'bad' })
        .expect(400);
      expect(shortReasonRes.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // Credit ₹50.00 to add_money
      const creditRes = await request(app)
        .post(`/api/v1/admin/users/${user.id}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ wallet: 'add_money', amount: '50.00', reason: 'Goodwill credit bonus' })
        .expect(200);

      expect(creditRes.body.data.amount).toBe('50.00');
      expect(creditRes.body.data.balances.addMoney).toBe('50.00');
      expect(creditRes.body.data.balances.total).toBe('50.00');

      // Verify ledger row created with type admin_adjustment
      const ledgerCheck = await query(
        'SELECT type, amount, wallet FROM wallet_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
        [user.id]
      );
      expect(ledgerCheck.rows[0].type).toBe('admin_adjustment');
      expect(ledgerCheck.rows[0].amount).toBe('50.00');

      // Debit ₹20.00 from add_money
      const debitRes = await request(app)
        .post(`/api/v1/admin/users/${user.id}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ wallet: 'add_money', amount: '-20.00', reason: 'Correction clawback' })
        .expect(200);

      expect(debitRes.body.data.amount).toBe('-20.00');
      expect(debitRes.body.data.balances.addMoney).toBe('30.00');
      expect(debitRes.body.data.balances.total).toBe('30.00');

      // Overdraft debit (e.g. -40.00 when balance is 30.00) rejected with LOW_BALANCE
      const overdraftRes = await request(app)
        .post(`/api/v1/admin/users/${user.id}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ wallet: 'add_money', amount: '-40.00', reason: 'Overdraft attempt' })
        .expect(402);

      expect(overdraftRes.body.error.code).toBe(ErrorCodes.LOW_BALANCE);

      // Credit with integer string (e.g. '100') formats response amount as 2-decimal '100.00'
      const intCreditRes = await request(app)
        .post(`/api/v1/admin/users/${user.id}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ wallet: 'winning', amount: '100', reason: 'Integer format test' })
        .expect(200);
      expect(intCreditRes.body.data.amount).toBe('100.00');
      expect(intCreditRes.body.data.balances.winning).toBe('100.00');
    });

    it('GET /admin/users/:id returns user detail, wallets, recent ledger, and match history', async () => {
      const { staff: admin, token: adminToken } = await createTestStaff('admin');
      const { user } = await createTestUser();

      // Add a ledger entry
      await request(app)
        .post(`/api/v1/admin/users/${user.id}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ wallet: 'winning', amount: '100.00', reason: 'Manual compensation' })
        .expect(200);

      const res = await request(app)
        .get(`/api/v1/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.profile.email).toBe(user.email);
      expect(res.body.data.wallets.winning).toBe('100.00');
      expect(res.body.data.recentLedger).toHaveLength(1);
      expect(res.body.data.recentLedger[0].type).toBe('admin_adjustment');
      expect(res.body.data.matchHistory).toBeDefined();
    });
  });
});
