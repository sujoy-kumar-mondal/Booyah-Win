import { Router } from 'express';
import { authenticateStaff, requireStaff } from '../../middleware/auth.js';
import { staffWriteRateLimit } from '../../middleware/rateLimiters.js';
import { idParamHandler } from '../../middleware/validate.js';
import { StaffMatchesController } from './matches.staff.controller.js';
import { ResultsController, screenshotUpload } from './results.controller.js';

export const staffMatchesRouter = Router();

staffMatchesRouter.use(authenticateStaff, requireStaff, staffWriteRateLimit);
staffMatchesRouter.param('id', idParamHandler);

staffMatchesRouter.get('/', StaffMatchesController.listMatches);
staffMatchesRouter.post('/', StaffMatchesController.createMatch);
staffMatchesRouter.get('/:id', StaffMatchesController.getMatchDetail);
staffMatchesRouter.post('/:id/open-room', StaffMatchesController.openRoom);
staffMatchesRouter.post('/:id/go-live', StaffMatchesController.goLive);
staffMatchesRouter.post('/:id/cancel', StaffMatchesController.cancelMatch);
staffMatchesRouter.post('/:id/result', screenshotUpload, ResultsController.submitResult);
staffMatchesRouter.get('/:id/result', ResultsController.getResult);
