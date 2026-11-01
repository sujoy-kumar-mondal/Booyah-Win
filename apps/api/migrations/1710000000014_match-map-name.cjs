/**
 * Migration: Add map_name to matches table
 */

exports.up = (pgm) => {
  pgm.addColumn('matches', {
    map_name: {
      type: 'TEXT',
      notNull: true,
      default: 'Bermuda',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('matches', 'map_name');
};

