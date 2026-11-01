import { Request, Response, NextFunction } from 'express';
import { ReferralService } from './referral.service.js';

export class ReferralController {
  /**
   * GET /refer/:code
   * Server-side rendered HTML response containing dynamic Open Graph meta tags
   * for WhatsApp, Facebook, Telegram crawlers, plus instant browser redirect.
   */
  static async handleReferralPage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.params.code || '';
      const referrer = await ReferralService.getReferrerByCode(code);

      // Determine public frontend origin for absolute OG URLs
      const forwardedProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const forwardedHost = (req.headers['x-forwarded-host'] as string) || req.headers.host;
      const configuredOrigin = process.env.FRONTEND_ORIGIN || 'https://booyah-win.vercel.app';

      // Auto-detect public website origin from headers if available (excluding backend host like onrender)
      const origin = forwardedHost && !forwardedHost.includes('onrender.com')
        ? `${forwardedProto}://${forwardedHost}`
        : configuredOrigin;

      const userAgent = (req.headers['user-agent'] as string) || '';
      const html = ReferralService.renderOpenGraphHtml(referrer, { origin, userAgent });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      res.status(200).send(html);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/refer/lookup/:code
   * Lightweight JSON endpoint to check code validity from frontend.
   */
  static async lookupReferralCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.params.code || '';
      const referrer = await ReferralService.getReferrerByCode(code);
      res.status(200).json({
        exists: referrer.exists,
        name: referrer.name || null,
        referralCode: referrer.referralCode,
      });
    } catch (err) {
      next(err);
    }
  }
}
