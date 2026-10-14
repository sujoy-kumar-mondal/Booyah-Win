import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';

const app = createApp({ enableRateLimiting: false });

describe('Referral Open Graph SSR & Lookup Routes', () => {
  beforeEach(async () => {
    await truncateAllTables();

    // Create a referrer user
    await query(
      `INSERT INTO users (email, name, mobile, ff_name, ff_id, upi_id, referral_code, date_of_birth)
       VALUES ('referrer@example.com', 'Aman Sharma', '9876543210', 'AmanFF', 'FF123456', 'aman@upi', 'BW9999', '2000-01-01')`
    );
  });

  it('GET /refer/:code renders dynamic Open Graph HTML with referrer name for valid code', async () => {
    const res = await request(app)
      .get('/refer/BW9999')
      .expect(200);

    expect(res.headers['content-type']).toContain('text/html');
    const html = res.text;

    // Check Open Graph tags
    expect(html).toContain('<meta property="og:title" content="Aman Sharma invited you to Booyah Win"');
    expect(html).toContain('Play Free Fire tournaments and win real money. Sign up with Aman Sharma');
    expect(html).toContain('<meta property="og:image"');
    expect(html).toContain('og-referral-banner.jpg');
    expect(html).toContain('<meta property="og:image:width" content="1200"');
    expect(html).toContain('<meta property="og:image:height" content="630"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');

    // Check redirection script and meta refresh
    expect(html).toContain('register?ref=BW9999');
    expect(html).toContain('localStorage.setItem(\'booyah_ref\', "BW9999")');
  });

  it('GET /refer/:code renders fallback Open Graph tags when referral code does not exist', async () => {
    const res = await request(app)
      .get('/refer/UNKNOWNCODE')
      .expect(200);

    expect(res.headers['content-type']).toContain('text/html');
    const html = res.text;

    // Fallback title and description
    expect(html).toContain('<meta property="og:title" content="Play Free Fire Tournaments &amp; Win Money | Booyah Win"');
    expect(html).toContain('<meta property="og:image"');
    expect(html).toContain('og-referral-banner.jpg');
    expect(html).toContain('register?ref=UNKNOWNCODE');
  });

  it('GET /api/v1/refer/lookup/:code returns JSON lookup details', async () => {
    const validRes = await request(app)
      .get('/api/v1/refer/lookup/BW9999')
      .expect(200);

    expect(validRes.body).toEqual({
      exists: true,
      name: 'Aman Sharma',
      referralCode: 'BW9999',
    });

    const invalidRes = await request(app)
      .get('/api/v1/refer/lookup/NOTREAL')
      .expect(200);

    expect(invalidRes.body).toEqual({
      exists: false,
      name: null,
      referralCode: 'NOTREAL',
    });
  });
});
