/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // Relax the hardcoded CHECK (amount >= 50) constraint on withdrawal_requests to CHECK (amount > 0)
  // so that the minimum withdrawal limit is dynamically governed by app_settings (min_withdrawal).
  pgm.sql(`
    ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_amount_check;
    ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_amount_check CHECK (amount > 0);
  `);

  // Seed default withdrawal limits if not already present
  pgm.sql(`
    INSERT INTO app_settings (key, value)
    VALUES 
      ('min_withdrawal', '50.00'),
      ('max_withdrawal', '10000.00')
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_amount_check;
    ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_amount_check CHECK (amount >= 50);
  `);
};

