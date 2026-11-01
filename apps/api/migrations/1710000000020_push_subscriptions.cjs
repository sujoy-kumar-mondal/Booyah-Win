/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable(
    'push_subscriptions',
    {
      id: { type: 'bigserial', primaryKey: true },
      user_id: {
        type: 'bigint',
        references: 'users',
        onDelete: 'CASCADE',
        notNull: false,
      },
      endpoint: { type: 'text', notNull: true, unique: true },
      p256dh: { type: 'text', notNull: true },
      auth: { type: 'text', notNull: true },
      user_agent: { type: 'text', notNull: false },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true }
  );

  pgm.createIndex('push_subscriptions', 'user_id', {
    name: 'idx_push_subscriptions_user',
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropTable('push_subscriptions');
};

