/**
 * Public Important Updates Routes
 */

import { Router } from 'express';
import { UpdatesController } from './updates.controller.js';

export const updatesRouter = Router();

// Public: list active important updates for players
updatesRouter.get('/', UpdatesController.listActiveUpdates);
