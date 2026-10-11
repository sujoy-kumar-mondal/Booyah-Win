import { Router } from 'express';
import { authenticateStaff, requireAdmin } from '../../../middleware/auth.js';
import { staffWriteRateLimit } from '../../../middleware/rateLimiters.js';
import { idParamHandler } from '../../../middleware/validate.js';
import { AdminResultsController } from './admin.results.controller.js';

export const adminResultsRouter = Router();

adminResultsRouter.use(authenticateStaff, requireAdmin, staffWriteRateLimit);
adminResultsRouter.param('matchId', idParamHandler);
adminResultsRouter.param('id', idParamHandler);

adminResultsRouter.get('/', AdminResultsController.listPendingQueue);
adminResultsRouter.get('/queue', AdminResultsController.listPendingQueue);
adminResultsRouter.get('/:matchId/preview', AdminResultsController.preview);
adminResultsRouter.post('/:matchId/approve', AdminResultsController.approve);
adminResultsRouter.post('/:matchId/reject', AdminResultsController.reject);
adminResultsRouter.post('/:matchId/reverse', AdminResultsController.reverse);
