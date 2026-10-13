import { Router } from 'express';
import { authenticateStaff, requireStaff } from '../../../middleware/auth.js';
import { staffUserViewRateLimit } from '../../../middleware/rateLimiters.js';
import { idParamHandler } from '../../../middleware/validate.js';
import { StaffUsersController } from './staff.users.controller.js';

export const staffUsersRouter = Router();

staffUsersRouter.use(authenticateStaff, requireStaff);
staffUsersRouter.param('id', idParamHandler);

staffUsersRouter.get('/', StaffUsersController.listUsers);
staffUsersRouter.get('/:id', staffUserViewRateLimit, StaffUsersController.getUserDetail);
