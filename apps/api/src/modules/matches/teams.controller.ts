import type { Request, Response, NextFunction } from 'express';
import {
  createTeam,
  listUserInvites,
  acceptInvite,
  declineInvite,
  replaceInvite,
  disbandTeam,
} from './teams.service.js';

export class TeamsController {
  static async createTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matchId = req.params.id;
      const leaderId = req.user!.id;
      const { teamName, memberFfIds } = req.body;

      const team = await createTeam(leaderId, matchId, { teamName, memberFfIds });
      res.status(201).json({ data: { team } });
    } catch (err) {
      next(err);
    }
  }

  static async listUserInvites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const invites = await listUserInvites(userId);
      res.status(200).json({ data: { invites } });
    } catch (err) {
      next(err);
    }
  }

  static async acceptInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const inviteId = req.params.id;
      await acceptInvite(userId, inviteId);
      res.status(200).json({ data: { message: 'Team invite accepted successfully' } });
    } catch (err) {
      next(err);
    }
  }

  static async declineInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const inviteId = req.params.id;
      await declineInvite(userId, inviteId);
      res.status(200).json({ data: { message: 'Team invite declined' } });
    } catch (err) {
      next(err);
    }
  }

  static async replaceInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matchId = req.params.id;
      const leaderId = req.user!.id;
      const { oldFfId, newFfId } = req.body;
      await replaceInvite(leaderId, matchId, { oldFfId, newFfId });
      res.status(200).json({ data: { message: 'Invite replaced successfully' } });
    } catch (err) {
      next(err);
    }
  }

  static async disbandTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matchId = req.params.id;
      const leaderId = req.user!.id;
      await disbandTeam(leaderId, matchId);
      res.status(200).json({ data: { message: 'Team disbanded and members refunded' } });
    } catch (err) {
      next(err);
    }
  }
}
