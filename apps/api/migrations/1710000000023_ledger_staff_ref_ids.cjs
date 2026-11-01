/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    -- Update wallet_ledger ref_id for admin adjustments to use BW-STF- prefix
    UPDATE wallet_ledger
    SET ref_id = 'BW-STF-' || regexp_replace(ref_id, '^(?:BW-)?(?:STF-)?', '')
    WHERE (type = 'admin_adjustment' OR ref_type = 'admin_adjustment')
      AND ref_id IS NOT NULL
      AND ref_id NOT LIKE 'BW-STF-%';
  `);
};

exports.down = (pgm) => {
  // No-op rollback
};

