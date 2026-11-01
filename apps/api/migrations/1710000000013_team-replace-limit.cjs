/**
 * Migration: Add replace_count to teams table to enforce 1-time teammate replacement limit
 */

exports.up = (pgm) => {
  pgm.addColumn('teams', {
    replace_count: {
      type: 'INTEGER',
      notNull: true,
      default: 0,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('teams', 'replace_count');
};

