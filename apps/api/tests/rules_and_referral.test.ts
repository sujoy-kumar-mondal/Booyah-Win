/**
 * Rules and Referral Summary Integration Tests
 *
 * Requirements Tested:
 * 1. GET /api/v1/rules returns single-source numbers: referralReward, maxCashbackUsagePercent, minWithdrawal.
 * 2. GET /api/v1/me/referral-summary:
 *    - referredCount = referrals where referrer_id = user
 *    - bonusEarnedCount = referrals where referrer_id = user AND credited_at IS NOT NULL
 *    - totalBonusEarned = SUM(wallet_ledger.amount WHERE user_id = user AND type = 'referral')
 * 3. Verified after first deposit approval and after first match join.
 * 4. Zero personal data of referred users in response.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { query, withTransaction } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { RULES } from '../src/config/rules.js';
import { creditReferralReward } from '../src/modules/wallet/wallet.service.js';

const app = createApp({ enableRateLimiting: false });

async function createTestUser(suffix: string) {
  const email = `player_${suffix}@example.com`;
  const mobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const ffId = `FF_${suffix}_${Math.floor(Math.random() * 100000)}`;
  const userFfName = `Player_${suffix}`;
  const upiId = `player_${suffix}@upi`;
  const referralCode = `REF_${suffix}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const uRes = await query<{ id: string }>(
    `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
     VALUES ($1, $2, $3, $4, $5, $6, '2000-01-01', $7)
     RETURNING id`,
    [email, `Real Name ${suffix}`, mobile, ffId, userFfName, upiId, referralCode]
  );
  const userId = uRes.rows[0].id.toString();

  await query('INSERT INTO wallets (user_id, add_money, cashback, winning) VALUES ($1, 0, 0, 0)', [userId]);

  const sessionId = crypto.randomUUID();
  await query(
    `INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`,
    [sessionId, userId]
  );
  const token = signSessionToken({ sub: userId, typ: 'user', sid: sessionId, role: 'user' }, '30d');

  return { userId, token, referralCode };
}

describe('Rules & Referral Summary APIs', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  it('Requirement 2: GET /api/v1/rules returns single-source configuration values', async () => {
    const res = await request(app).get('/api/v1/rules');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      referralReward: '5.00',
      maxCashbackUsagePercent: RULES.CASHBACK_ENTRY_FEE_CAP_PERCENT,
      minWithdrawal: '50.00',
    });
  });

  it('Requirement 10: GET /api/v1/me/referral-summary computes exact counts and total bonus earned', async () => {
    const referrer = await createTestUser('referrer');
    const friend1 = await createTestUser('friend1');
    const friend2 = await createTestUser('friend2');

    // Insert 2 referral rows for referrer
    await query(
      `INSERT INTO referrals (referrer_id, referred_id, reward, credited_at)
       VALUES ($1, $2, 5.00, NULL), ($1, $3, 5.00, NULL)`,
      [referrer.userId, friend1.userId, friend2.userId]
    );

    // Initial state: 2 referred, 0 bonuses earned, 0 total earned
    const res1 = await request(app)
      .get('/api/v1/me/referral-summary')
      .set('Authorization', `Bearer ${referrer.token}`);
    expect(res1.status).toBe(200);
    expect(res1.body.data).toEqual({
      referralCode: referrer.referralCode,
      referredCount: 2,
      bonusEarnedCount: 0,
      totalBonusEarned: '0.00',
    });

    // Simulate friend1's first deposit approval triggering creditReferralReward
    await withTransaction(async (client) => {
      // Pre-lock wallets in ascending user_id order
      const ids = [referrer.userId, friend1.userId].sort((a, b) => Number(a) - Number(b));
      for (const id of ids) {
        await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [id]);
      }
      await creditReferralReward(client, friend1.userId);
    });

    // State after friend1's deposit: 2 referred, 1 bonus earned, ₹5.00 total
    const res2 = await request(app)
      .get('/api/v1/me/referral-summary')
      .set('Authorization', `Bearer ${referrer.token}`);
    expect(res2.status).toBe(200);
    expect(res2.body.data).toEqual({
      referralCode: referrer.referralCode,
      referredCount: 2,
      bonusEarnedCount: 1,
      totalBonusEarned: '5.00',
    });

    // Simulate friend2's first match join triggering creditReferralReward
    await withTransaction(async (client) => {
      const ids = [referrer.userId, friend2.userId].sort((a, b) => Number(a) - Number(b));
      for (const id of ids) {
        await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [id]);
      }
      await creditReferralReward(client, friend2.userId);
    });

    // State after friend2's match join: 2 referred, 2 bonuses earned, ₹10.00 total
    const res3 = await request(app)
      .get('/api/v1/me/referral-summary')
      .set('Authorization', `Bearer ${referrer.token}`);
    expect(res3.status).toBe(200);
    expect(res3.body.data).toEqual({
      referralCode: referrer.referralCode,
      referredCount: 2,
      bonusEarnedCount: 2,
      totalBonusEarned: '10.00',
    });

    // Verify strict privacy: zero personal details of referred users
    expect(res3.body.data.friends).toBeUndefined();
    expect(res3.body.data.users).toBeUndefined();
    expect(res3.body.data.items).toBeUndefined();
    expect(Object.keys(res3.body.data).sort()).toEqual(
      ['bonusEarnedCount', 'referralCode', 'referredCount', 'totalBonusEarned'].sort()
    );
  });
});
