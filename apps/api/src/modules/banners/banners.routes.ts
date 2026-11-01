/**
 * Public Banner Routes
 */

import { Router } from 'express';
import { BannersController } from './banners.controller.js';

export const bannersRouter = Router();

bannersRouter.get('/', BannersController.listActiveBanners);
