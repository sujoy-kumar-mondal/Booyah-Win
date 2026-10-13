import { Router } from 'express';
import { LeaderboardController } from './leaderboard.controller.js';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', LeaderboardController.getLeaderboard);
