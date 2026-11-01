/* eslint-disable no-undef */
/**
 * Migration 1710000000007: Seed cashback_max_percent default setting.
 * Leaves existing production rows untouched via ON CONFLICT (key) DO NOTHING.
 */
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO app_settings (key, value)
    VALUES ('cashback_max_percent', '5')
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM app_settings
    WHERE key = 'cashback_max_percent';
  `);
};
