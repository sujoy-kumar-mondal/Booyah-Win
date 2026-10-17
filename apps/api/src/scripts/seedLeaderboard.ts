import { config } from '../config/index.js';
import { closePool, query, isUntrustedCertificateError, UNTRUSTED_CERT_SAFE_REASON } from '../db/index.js';
import { assertDatabaseSafety } from './scriptUtils.js';

export async function seedLeaderboard(): Promise<void> {
  const targetDb =
    config.NODE_ENV === 'test'
      ? config.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL
      : config.DATABASE_URL || process.env.DATABASE_URL;
  assertDatabaseSafety(targetDb);

  console.log('--- Checking database state for Weekly Leaderboard ---');

  // 1. Get database current week boundaries
  const weekRes = await query<{ week_start: Date; next_week_start: Date; now: Date }>(`
    SELECT
      (date_trunc('week', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata') AS week_start,
      ((date_trunc('week', timezone('Asia/Kolkata', now())) + interval '7 days') AT TIME ZONE 'Asia/Kolkata') AS next_week_start,
      now() AS now
  `);
  const { week_start: weekStart, now: dbNow } = weekRes.rows[0];
  console.log(`Current week window: ${weekStart.toISOString()} to ${weekRes.rows[0].next_week_start.toISOString()}`);

  // 2. Find all existing non-deleted users
  const existingUsers = await query<{ id: string; name: string; ff_name: string; mobile: string }>(`
    SELECT id, name, ff_name, mobile
    FROM users
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `);

  console.log(`Found ${existingUsers.rowCount} existing active users in database.`);

  const samplePlayers = [
    { name: 'Aakash Sharma', ff_name: 'Aakash_Sniper', mobile: '9811000001', ff_id: '1981100001', winAmount: 1200 },
    { name: 'Rohan Verma', ff_name: 'Rohan_Pro', mobile: '9811000002', ff_id: '1981100002', winAmount: 850 },
    { name: 'Pooja Patel', ff_name: 'Pooja_Kills', mobile: '9811000003', ff_id: '1981100003', winAmount: 600 },
    { name: 'Vikram Singh', ff_name: 'Vikram_FF', mobile: '9811000004', ff_id: '1981100004', winAmount: 450 },
    { name: 'Sneha Reddy', ff_name: 'Sneha_Queen', mobile: '9811000005', ff_id: '1981100005', winAmount: 300 },
    { name: 'Kabir Das', ff_name: 'Kabir_Gamer', mobile: '9811000006', ff_id: '1981100006', winAmount: 200 },
    { name: 'Arjun Mehta', ff_name: 'Arjun_Elite', mobile: '9811000007', ff_id: '1981100007', winAmount: 150 },
    { name: 'Riya Sen', ff_name: 'Riya_Shooter', mobile: '9811000008', ff_id: '1981100008', winAmount: 100 },
  ];

  const seededUserIds: { id: string; ff_name: string; winAmount: number }[] = [];

  // If there are existing registered users (e.g. user currently logged in in PWA), give the first one a winning entry!
  if (existingUsers.rows.length > 0) {
    const mainUser = existingUsers.rows[0];
    console.log(`Including active user "${mainUser.ff_name || mainUser.name}" (ID: ${mainUser.id}) on leaderboard with ₹500 winnings.`);
    seededUserIds.push({ id: mainUser.id, ff_name: mainUser.ff_name || mainUser.name, winAmount: 500 });
  }

  // Create or retrieve sample players
  for (const p of samplePlayers) {
    let userId: string;
    const existing = await query<{ id: string }>(
      'SELECT id FROM users WHERE mobile = $1 OR ff_name = $2',
      [p.mobile, p.ff_name]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      userId = existing.rows[0].id;
      // Ensure existing player has numeric ff_id
      await query(
        `UPDATE users SET ff_id = $1 WHERE id = $2 AND ff_id LIKE 'FF_%'`,
        [p.ff_id, userId]
      );
    } else {
      const email = `${p.ff_name.toLowerCase()}@test.booyah`;
      const upiId = `${p.ff_name.toLowerCase()}@upi`;
      const refCode = `REF${Math.floor(100000 + Math.random() * 900000)}`;
      const userRes = await query<{ id: string }>(
        `INSERT INTO users (email, name, mobile, ff_name, ff_id, upi_id, referral_code, date_of_birth, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '2000-01-01', $8)
         RETURNING id`,
        [email, p.name, p.mobile, p.ff_name, p.ff_id, upiId, refCode, dbNow]
      );
      userId = userRes.rows[0].id;

      // Create wallet record
      await query(
        `INSERT INTO wallets (user_id, add_money, cashback, winning)
         VALUES ($1, 0, 0, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
    }

    seededUserIds.push({ id: userId, ff_name: p.ff_name, winAmount: p.winAmount });
  }

  // Ensure we have a sample match to reference
  let matchId: number;
  const existingMatch = await query<{ id: number }>('SELECT id FROM matches ORDER BY created_at DESC LIMIT 1');
  if (existingMatch.rowCount && existingMatch.rowCount > 0) {
    matchId = existingMatch.rows[0].id;
  } else {
    // Create a mock completed tournament match
    const newMatch = await query<{ id: number }>(`
      INSERT INTO matches (
        title, game, match_type, entry_fee, prize_pool, starts_at, status, created_at
      )
      VALUES (
        'Free Fire Weekly Championship', 'free_fire', 'solo', 50.00, 2500.00, now() - interval '2 hours', 'completed', now() - interval '3 hours'
      )
      RETURNING id
    `);
    matchId = newMatch.rows[0].id;
  }
  console.log(`Using match ID ${matchId} for winning ledger references.`);

  // Clear previous test winning ledger rows for this week if any, or add new ones
  for (let i = 0; i < seededUserIds.length; i++) {
    const player = seededUserIds[i];
    // Slightly stagger timestamp so tie breaks are predictable
    const winTime = new Date(dbNow.getTime() - (seededUserIds.length - i) * 60000);

    // Insert winning ledger row
    await query(`
      INSERT INTO wallet_ledger (
        user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id, created_at
      )
      VALUES (
        $1, 'winning', 'winning', $2, $2, $2, 'match', $3, $4
      )
    `, [player.id, player.winAmount, matchId, winTime]);

    // Update wallet winning balance
    await query(`
      UPDATE wallets
      SET winning = winning + $1
      WHERE user_id = $2
    `, [player.winAmount, player.id]);

    console.log(`  + Seeded win: ${player.ff_name} -> ₹${player.winAmount} (Match #${matchId})`);
  }

  console.log('✅ Weekly Leaderboard successfully seeded with active winners!');
}

if (process.argv[1]?.includes('seedLeaderboard')) {
  seedLeaderboard()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      if (isUntrustedCertificateError(err) || err.message === UNTRUSTED_CERT_SAFE_REASON) {
        console.error(UNTRUSTED_CERT_SAFE_REASON);
      } else {
        console.error('Failed to seed leaderboard:', err.message);
      }
      await closePool();
      process.exit(1);
    });
}
