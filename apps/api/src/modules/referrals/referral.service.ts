import { query } from '../../db/index.js';

export interface ReferrerInfo {
  exists: boolean;
  name: string;
  referralCode: string;
}

export class ReferralService {
  /**
   * Look up user by referral code (case-insensitive).
   */
  static async getReferrerByCode(code: string): Promise<ReferrerInfo> {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return { exists: false, name: '', referralCode: '' };
    }

    const res = await query<{ id: string; name: string; referral_code: string }>(
      'SELECT id, name, referral_code FROM users WHERE UPPER(referral_code) = $1 AND deleted_at IS NULL',
      [cleanCode]
    );

    if (res.rowCount && res.rows[0]) {
      return {
        exists: true,
        name: res.rows[0].name,
        referralCode: res.rows[0].referral_code,
      };
    }

    return {
      exists: false,
      name: '',
      referralCode: cleanCode,
    };
  }

  /**
   * Generates server-rendered HTML containing Open Graph and Twitter Card tags
   * for WhatsApp, Facebook, Telegram, and other social crawlers.
   * Also includes immediate redirection for real human browsers.
   */
  static renderOpenGraphHtml(referrer: ReferrerInfo, options?: { origin?: string }): string {
    const defaultOrigin = process.env.FRONTEND_ORIGIN || 'https://booyah-win.vercel.app';
    const origin = (options?.origin || defaultOrigin).replace(/\/+$/, '');

    const title = referrer.exists
      ? `${referrer.name} invited you to Booyah Win`
      : 'Play Free Fire Tournaments & Win Money | Booyah Win';

    const description = referrer.exists
      ? `Play Free Fire tournaments and win real money. Sign up with ${referrer.name}'s link and start earning today.`
      : 'Play Free Fire tournaments and win real money. Sign up today, show your skills, and earn your joining bonus.';

    const code = referrer.referralCode;
    const ogUrl = code ? `${origin}/refer/${encodeURIComponent(code)}` : origin;
    const redirectUrl = code ? `${origin}/register?ref=${encodeURIComponent(code)}` : `${origin}/register`;
    const imageUrl = `${origin}/og-referral-banner.jpg`;

    const escapedTitle = escapeHtml(title);
    const escapedDesc = escapeHtml(description);
    const escapedUrl = escapeHtml(ogUrl);
    const escapedImage = escapeHtml(imageUrl);
    const escapedRedirect = escapeHtml(redirectUrl);
    const jsonCode = JSON.stringify(code || '');
    const jsonRedirect = JSON.stringify(redirectUrl);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapedTitle}</title>
  <meta name="description" content="${escapedDesc}" />

  <!-- Open Graph / WhatsApp / Facebook / Telegram -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Booyah Win" />
  <meta property="og:url" content="${escapedUrl}" />
  <meta property="og:title" content="${escapedTitle}" />
  <meta property="og:description" content="${escapedDesc}" />
  <meta property="og:image" content="${escapedImage}" />
  <meta property="og:image:secure_url" content="${escapedImage}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Booyah Win - Play Free Fire and Win Real Cash" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@BooyahWin" />
  <meta name="twitter:url" content="${escapedUrl}" />
  <meta name="twitter:title" content="${escapedTitle}" />
  <meta name="twitter:description" content="${escapedDesc}" />
  <meta name="twitter:image" content="${escapedImage}" />

  <!-- Instant Browser Redirect for Real Users (Ignored by crawlers) -->
  <meta http-equiv="refresh" content="0;url=${escapedRedirect}" />
  <script>
    try {
      if (${jsonCode}) {
        localStorage.setItem('booyah_ref', ${jsonCode});
        document.cookie = 'booyah_ref=' + encodeURIComponent(${jsonCode}) + '; path=/; max-age=2592000; SameSite=Lax';
      }
    } catch (e) {}
    window.location.replace(${jsonRedirect});
  </script>

  <style>
    body {
      background-color: #030712;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 1.25rem;
      padding: 2rem;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: #10b981;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 9999px;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 800;
      margin: 0 0 0.5rem 0;
      color: #f9fafb;
    }
    p {
      font-size: 0.875rem;
      color: #9ca3af;
      margin: 0 0 1.5rem 0;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      width: 100%;
      box-sizing: border-box;
      background: #10b981;
      color: #030712;
      font-weight: 800;
      font-size: 0.875rem;
      padding: 0.875rem 1.5rem;
      border-radius: 0.75rem;
      text-decoration: none;
      transition: background 0.15s;
    }
    .btn:hover {
      background: #34d399;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">BOOYAH WIN</div>
    <h1>${escapedTitle}</h1>
    <p>${escapedDesc}</p>
    <a href="${escapedRedirect}" class="btn">Continue to Booyah Win &rarr;</a>
  </div>
</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
