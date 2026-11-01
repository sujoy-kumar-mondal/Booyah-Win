import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import {
  getVapidPublicKey,
  sendPushToUsers,
  sendPushBroadcast,
} from '../src/modules/users/webpush.service.js';
import webpush from 'web-push';

const app = createApp({ enableRateLimiting: false });

let counter = 5000;
function next(): number {
  return ++counter;
}

async function createTestUser(): Promise<{ id: string; token: string }> {
  const i = next();
  const mobile = '9' + String(i).padStart(9, '0');
  const res = await query(
    `INSERT INTO users (username, email, name, mobile, ff_id, ff_name, upi_id, date_of_birth)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '1995-01-01')
     RETURNING id`,
    [
      `player_${i}`,
      `player${i}@test.com`,
      `Player ${i}`,
      mobile,
      `FF${String(i).padStart(8, '0')}`,
      `FFName${i}`,
      `player${i}@upi`,
    ]
  );
  const userId = res.rows[0].id.toString();
  await query('INSERT INTO wallets (user_id) VALUES ($1)', [userId]);

  const sid = crypto.randomUUID();
  await query('INSERT INTO sessions (id, account_type, account_id) VALUES ($1, $2, $3)', [
    sid,
    'user',
    userId,
  ]);
  const token = signSessionToken({ sub: userId, typ: 'user', sid }, '1h');
  return { id: userId, token };
}

describe('Web Push Notifications API', () => {
  beforeEach(async () => {
    await truncateAllTables();
    vi.restoreAllMocks();
  });

  it('GET /api/v1/notifications/push-key returns VAPID public key', async () => {
    const res = await request(app).get('/api/v1/notifications/push-key').expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.publicKey).toBeDefined();
    expect(typeof res.body.data.publicKey).toBe('string');
    expect(res.body.data.publicKey.length).toBeGreaterThan(10);
  });

  it('POST /api/v1/notifications/push-subscribe registers subscription for authenticated user', async () => {
    const { id: userId, token } = await createTestUser();
    const endpoint = 'https://fcm.googleapis.com/fcm/send/test-sub-123';

    const res = await request(app)
      .post('/api/v1/notifications/push-subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({
        endpoint,
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0VU',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      })
      .expect(201);

    expect(res.body.message).toMatch(/registered successfully/i);

    // Verify stored in DB
    const subRes = await query('SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = $1', [
      endpoint,
    ]);
    expect(subRes.rowCount).toBe(1);
    expect(subRes.rows[0].user_id.toString()).toBe(userId);
  });

  it('POST /api/v1/notifications/push-subscribe registers subscription for guest (no auth header)', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/guest-sub-456';

    const res = await request(app)
      .post('/api/v1/notifications/push-subscribe')
      .send({
        endpoint,
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0VU',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      })
      .expect(201);

    expect(res.body.message).toMatch(/registered successfully/i);

    const subRes = await query('SELECT user_id, endpoint FROM push_subscriptions WHERE endpoint = $1', [
      endpoint,
    ]);
    expect(subRes.rowCount).toBe(1);
    expect(subRes.rows[0].user_id).toBeNull();
  });

  it('POST /api/v1/notifications/push-subscribe rejects missing endpoint with 400', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/push-subscribe')
      .send({
        keys: {
          p256dh: 'abc',
          auth: 'xyz',
        },
      })
      .expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('POST /api/v1/notifications/push-unsubscribe removes subscription', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/to-remove';

    // Insert first
    await query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ($1, 'key1', 'auth1')`,
      [endpoint]
    );

    const res = await request(app)
      .post('/api/v1/notifications/push-unsubscribe')
      .send({ endpoint })
      .expect(200);

    expect(res.body.message).toMatch(/removed successfully/i);

    const checkRes = await query('SELECT id FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    expect(checkRes.rowCount).toBe(0);
  });

  it('sends push notifications to targeted user and cleans up expired 410 subscriptions', async () => {
    const { id: userId } = await createTestUser();
    const endpoint = 'https://fcm.googleapis.com/fcm/send/expired-sub';

    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, 'key1', 'auth1')`,
      [userId, endpoint]
    );

    // Mock webpush.sendNotification to simulate an expired subscription (HTTP 410 Gone)
    const sendNotificationSpy = vi
      .spyOn(webpush, 'sendNotification')
      .mockRejectedValueOnce({ statusCode: 410, message: 'Gone' });

    const sent = await sendPushToUsers([userId], {
      title: 'Match Live',
      message: 'Your match is live now!',
      actionUrl: '/matches/1',
    });

    expect(sent).toBe(0);
    expect(sendNotificationSpy).toHaveBeenCalledTimes(1);

    // Expired subscription should have been automatically cleaned up from database
    const checkRes = await query('SELECT id FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    expect(checkRes.rowCount).toBe(0);
  });

  it('POST /api/v1/notifications/push-test sends test push to authenticated user', async () => {
    const { id: userId, token } = await createTestUser();
    const endpoint = 'https://fcm.googleapis.com/fcm/send/active-sub';

    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, 'key1', 'auth1')`,
      [userId, endpoint]
    );

    const sendSpy = vi.spyOn(webpush, 'sendNotification').mockResolvedValueOnce({} as any);

    const res = await request(app)
      .post('/api/v1/notifications/push-test')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.sentCount).toBe(1);
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });
});

