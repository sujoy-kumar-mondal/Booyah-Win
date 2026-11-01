/**
 * Migration: Seeds default 'invitation_text' into app_settings table.
 */
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO app_settings (key, value)
    VALUES (
      'invitation_text',
      E'Hey, Download Booyah Win - Play Free Fire Tournaments & Win Money\\nJoin tournaments, show your skills and win real cash prizes!'
    )
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM app_settings WHERE key = 'invitation_text';
  `);
};

