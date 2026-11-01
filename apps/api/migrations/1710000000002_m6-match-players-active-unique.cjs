/* eslint-disable no-undef */
/**
 * Milestone 6 schema changes:
 *  Replace UNIQUE (match_id, user_id) on match_players with a partial unique
 *  index WHERE refunded_at IS NULL so refunded players can rejoin or participate
 *  in another team after disband/refund.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE match_players DROP CONSTRAINT IF EXISTS match_players_match_id_user_id_key;
    DROP INDEX IF EXISTS match_players_match_id_user_id_key;

    CREATE UNIQUE INDEX IF NOT EXISTS match_players_match_id_user_id_active_unique
      ON match_players (match_id, user_id)
      WHERE refunded_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS match_players_match_id_user_id_active_unique;
    ALTER TABLE match_players ADD CONSTRAINT match_players_match_id_user_id_key UNIQUE (match_id, user_id);
  `);
};
