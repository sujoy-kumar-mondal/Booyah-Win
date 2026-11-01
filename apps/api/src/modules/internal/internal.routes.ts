import { Router } from 'express';
import { SchedulerController } from '../matches/scheduler.controller.js';

export const internalRouter = Router();

internalRouter.post('/jobs/tick', SchedulerController.tick);
internalRouter.post('/leaderboard/refresh', SchedulerController.refreshLeaderboards);
