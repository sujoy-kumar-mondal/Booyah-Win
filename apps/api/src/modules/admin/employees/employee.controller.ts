import { Request, Response, NextFunction } from 'express';
import { createEmployeeSchema, updateEmployeeSchema } from '@booyah/shared';
import { EmployeeService } from './employee.service.js';

export class EmployeeController {
  static async createEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createEmployeeSchema.parse(req.body);
      const employee = await EmployeeService.createEmployee(req.staff!.id, input);
      res.status(201).json({ data: { employee } });
    } catch (err) {
      next(err);
    }
  }

  static async listEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

      const result = await EmployeeService.listEmployees({ q, limit, cursor });
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updates = updateEmployeeSchema.parse(req.body);
      const employee = await EmployeeService.updateEmployee(
        req.staff!.id,
        req.params.id,
        updates
      );
      res.status(200).json({ data: { employee } });
    } catch (err) {
      next(err);
    }
  }

  static async deleteEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await EmployeeService.deleteEmployee(req.staff!.id, req.params.id);
      res.status(200).json({ data: { message: 'Employee deleted successfully' } });
    } catch (err) {
      next(err);
    }
  }
}
