/* eslint-disable no-undef */
/**
 * Migration 1710000000025:
 * Seeds default 'referral_reward' = '5.00' into app_settings table.
 */
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO app_settings (key, value)
    VALUES ('referral_reward', '5.00')
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM app_settings WHERE key = 'referral_reward';
  `);
};

