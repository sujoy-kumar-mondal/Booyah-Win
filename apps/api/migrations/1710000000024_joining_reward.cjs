/* eslint-disable no-undef */
/**
 * Migration 1710000000024:
 * 1. Adds 'joining_reward' to ledger_type enum.
 * 2. Seeds default 'joining_reward' = '0.00' into app_settings table.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TYPE ledger_type ADD VALUE IF NOT EXISTS 'joining_reward';

    INSERT INTO app_settings (key, value)
    VALUES ('joining_reward', '0.00')
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  // Enum values cannot be removed in PostgreSQL.
  pgm.sql(`
    DELETE FROM app_settings WHERE key = 'joining_reward';
  `);
};

