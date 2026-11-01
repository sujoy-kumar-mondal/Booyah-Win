/**
 * Migration: Seeds default 'community_youtube' into app_settings table.
 */
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO app_settings (key, value)
    VALUES (
      'community_youtube',
      'https://youtube.com/@booyahwin'
    )
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM app_settings WHERE key = 'community_youtube';
  `);
};
