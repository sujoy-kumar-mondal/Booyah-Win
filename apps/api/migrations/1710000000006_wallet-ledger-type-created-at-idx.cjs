/* eslint-disable no-undef */
/**
 * Migration 1710000000006: Add composite index on wallet_ledger(type, created_at)
 * to optimize weekly leaderboard queries scanning match winnings and reversals within a week window.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS wallet_ledger_type_created_at_idx
      ON wallet_ledger (type, created_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS wallet_ledger_type_created_at_idx;
  `);
};
