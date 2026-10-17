/**
 * Migration: Add language column to users table
 */

exports.up = (pgm) => {
  pgm.addColumn('users', {
    language: {
      type: 'TEXT',
      notNull: true,
      default: 'en',
      check: "language IN ('en', 'bn')",
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'language');
};
