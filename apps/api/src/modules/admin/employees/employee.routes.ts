import { Router } from 'express';
import { authenticateStaff, requireAdmin } from '../../../middleware/auth.js';
import { staffWriteRateLimit } from '../../../middleware/rateLimiters.js';
import { idParamHandler } from '../../../middleware/validate.js';
import { EmployeeController } from './employee.controller.js';

export const employeeAdminRouter = Router();

// All employee management routes require admin role and are subject to write rate limit
employeeAdminRouter.use(authenticateStaff, requireAdmin, staffWriteRateLimit);
employeeAdminRouter.param('id', idParamHandler);

employeeAdminRouter.post('/', EmployeeController.createEmployee);
employeeAdminRouter.get('/', EmployeeController.listEmployees);
employeeAdminRouter.patch('/:id', EmployeeController.updateEmployee);
employeeAdminRouter.delete('/:id', EmployeeController.deleteEmployee);
