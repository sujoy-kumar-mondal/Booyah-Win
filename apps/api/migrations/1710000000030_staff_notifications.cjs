/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Add staff_id to push_subscriptions
  pgm.addColumn(
    'push_subscriptions',
    {
      staff_id: {
        type: 'text',
        references: 'staff',
        onDelete: 'CASCADE',
        notNull: false,
      },
    },
    { ifNotExists: true }
  );

  pgm.createIndex('push_subscriptions', 'staff_id', {
    name: 'idx_push_subscriptions_staff',
    ifNotExists: true,
  });

  // 2. Create staff_notifications table
  pgm.createTable(
    'staff_notifications',
    {
      id: { type: 'bigserial', primaryKey: true },
      target_role: { type: 'varchar(20)', notNull: true, default: 'all' },
      staff_id: {
        type: 'text',
        references: 'staff',
        onDelete: 'CASCADE',
        notNull: false,
      },
      type: { type: 'varchar(50)', notNull: true },
      title: { type: 'text', notNull: true },
      message: { type: 'text', notNull: true },
      action_url: { type: 'text', notNull: false },
      metadata: { type: 'jsonb', notNull: false },
      is_read: { type: 'boolean', notNull: true, default: false },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true }
  );

  pgm.createIndex('staff_notifications', ['target_role', 'created_at'], {
    name: 'idx_staff_notifications_role_created',
    ifNotExists: true,
  });

  pgm.createIndex('staff_notifications', ['staff_id', 'created_at'], {
    name: 'idx_staff_notifications_staff_created',
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropTable('staff_notifications', { ifExists: true });
  pgm.dropIndex('push_subscriptions', 'staff_id', {
    name: 'idx_push_subscriptions_staff',
    ifExists: true,
  });
  pgm.dropColumn('push_subscriptions', 'staff_id', { ifExists: true });
};

