import { Router } from 'express';
import { authenticateStaff, requireAdmin, requireElevatedSession } from '../../../middleware/auth.js';
import { staffWriteRateLimit } from '../../../middleware/rateLimiters.js';
import { idParamHandler } from '../../../middleware/validate.js';
import { AdminUsersController } from './admin.users.controller.js';

export const adminUsersRouter = Router();

// Gated strictly to Admin & subject to write rate limit
adminUsersRouter.use(authenticateStaff, requireAdmin, staffWriteRateLimit);
adminUsersRouter.param('id', idParamHandler);

adminUsersRouter.get('/', AdminUsersController.listUsers);
adminUsersRouter.get('/:id', AdminUsersController.getUserDetail);
adminUsersRouter.delete('/:id', requireElevatedSession, AdminUsersController.deleteUser);
adminUsersRouter.post('/:id/adjust', requireElevatedSession, AdminUsersController.adjustBalance);
