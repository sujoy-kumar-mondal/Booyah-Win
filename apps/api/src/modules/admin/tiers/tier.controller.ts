import { Request, Response, NextFunction } from 'express';
import { createTierSchema, updateTierSchema } from '@booyah/shared';
import { TierService } from './tier.service.js';

export class TierController {
  static async createTier(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createTierSchema.parse(req.body);
      const result = await TierService.createTier(req.staff!.id, input);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async listTiers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tiers = await TierService.listTiers();
      res.status(200).json({ data: { tiers } });
    } catch (err) {
      next(err);
    }
  }

  static async getTierById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tier = await TierService.getTierById(req.params.id);
      res.status(200).json({ data: { tier } });
    } catch (err) {
      next(err);
    }
  }

  static async updateTier(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updates = updateTierSchema.parse(req.body);
      const result = await TierService.updateTier(req.staff!.id, req.params.id, updates);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async deleteTier(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await TierService.deleteTier(req.staff!.id, req.params.id);
      res.status(200).json({ data: { message: 'Entry tier deleted successfully' } });
    } catch (err) {
      next(err);
    }
  }
}
