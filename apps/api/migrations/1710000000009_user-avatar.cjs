/**
 * Migration: Add avatar_key column to users table
 */

exports.up = (pgm) => {
  pgm.addColumn('users', {
    avatar_key: {
      type: 'TEXT',
      notNull: false,
      default: null,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'avatar_key');
};
