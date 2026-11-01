/* eslint-disable no-undef */
/**
 * Migration 1710000000026:
 * Moves any previously recorded joining rewards from cashback wallet to add_money (deposit) wallet.
 */
exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Transfer existing joining_reward cashback amounts to add_money in wallets
    UPDATE wallets w
    SET
      cashback = GREATEST(0, w.cashback - sub.total_reward),
      add_money = w.add_money + sub.total_reward
    FROM (
      SELECT user_id, SUM(amount) AS total_reward
      FROM wallet_ledger
      WHERE type = 'joining_reward' AND wallet = 'cashback'
      GROUP BY user_id
    ) sub
    WHERE w.user_id = sub.user_id;

    -- 2. Update wallet_ledger records to point to add_money
    UPDATE wallet_ledger
    SET wallet = 'add_money'
    WHERE type = 'joining_reward' AND wallet = 'cashback';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE wallets w
    SET
      add_money = GREATEST(0, w.add_money - sub.total_reward),
      cashback = w.cashback + sub.total_reward
    FROM (
      SELECT user_id, SUM(amount) AS total_reward
      FROM wallet_ledger
      WHERE type = 'joining_reward' AND wallet = 'add_money'
      GROUP BY user_id
    ) sub
    WHERE w.user_id = sub.user_id;

    UPDATE wallet_ledger
    SET wallet = 'cashback'
    WHERE type = 'joining_reward' AND wallet = 'add_money';
  `);
};

