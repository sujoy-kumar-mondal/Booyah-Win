/**
 * Admin Important Updates Routes
 */

import { Router } from 'express';
import { authenticateStaff, requireAdmin } from '../../../middleware/auth.js';
import { staffWriteRateLimit } from '../../../middleware/rateLimiters.js';
import { UpdatesController } from '../../updates/updates.controller.js';

export const adminUpdatesRouter = Router();

// All admin updates routes require staff authentication, admin role, and rate limiting
adminUpdatesRouter.use(authenticateStaff, requireAdmin, staffWriteRateLimit);

adminUpdatesRouter.get('/', UpdatesController.listAllUpdates);
adminUpdatesRouter.post('/', UpdatesController.createUpdate);
adminUpdatesRouter.patch('/:id', UpdatesController.updateUpdate);
adminUpdatesRouter.delete('/:id', UpdatesController.deleteUpdate);
