import { Router } from 'express';
import { ReferralController } from './referral.controller.js';

export const referralRouter = Router();

// API lookup
referralRouter.get('/lookup/:code', ReferralController.lookupReferralCode);

// SSR HTML page for crawlers and redirection
referralRouter.get('/:code', ReferralController.handleReferralPage);
