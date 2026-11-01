/* eslint-disable no-undef */
/**
 * Migration 1710000000005: Seed maintenance mode default settings.
 * Leaves existing production rows untouched via ON CONFLICT (key) DO NOTHING.
 */
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO app_settings (key, value)
    VALUES
      ('maintenance_enabled', 'false'),
      ('maintenance_message', 'Under scheduled maintenance. Please check back shortly.'),
      ('maintenance_until', '')
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM app_settings
    WHERE key IN ('maintenance_enabled', 'maintenance_message', 'maintenance_until');
  `);
};
