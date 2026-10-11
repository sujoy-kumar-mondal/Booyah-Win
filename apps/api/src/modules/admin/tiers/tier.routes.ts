import { Router } from 'express';
import { authenticateStaff, requireAdmin } from '../../../middleware/auth.js';
import { staffWriteRateLimit } from '../../../middleware/rateLimiters.js';
import { idParamHandler } from '../../../middleware/validate.js';
import { TierController } from './tier.controller.js';

export const tierAdminRouter = Router();

tierAdminRouter.use(authenticateStaff, requireAdmin, staffWriteRateLimit);
tierAdminRouter.param('id', idParamHandler);

tierAdminRouter.post('/', TierController.createTier);
tierAdminRouter.get('/', TierController.listTiers);
tierAdminRouter.get('/:id', TierController.getTierById);
tierAdminRouter.patch('/:id', TierController.updateTier);
tierAdminRouter.delete('/:id', TierController.deleteTier);
