/**
 * Migration: Add name_changed_at column to users table for monthly cooldown
 */

exports.up = (pgm) => {
  pgm.addColumn('users', {
    name_changed_at: {
      type: 'TIMESTAMPTZ',
      notNull: false,
      default: null,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'name_changed_at');
};

