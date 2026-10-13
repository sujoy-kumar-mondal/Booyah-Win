import { Router } from 'express';
import { RulesController } from './rules.controller.js';

export const rulesRouter = Router();

rulesRouter.get('/', RulesController.getRules);
