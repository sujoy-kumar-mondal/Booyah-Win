import { Router } from 'express';
import { ReferralController } from './referral.controller.js';

export const referralRouter = Router();

// SSR HTML page for crawlers and redirection
referralRouter.get('/:code', ReferralController.handleReferralPage);

// API lookup
referralRouter.get('/lookup/:code', ReferralController.lookupReferralCode);
