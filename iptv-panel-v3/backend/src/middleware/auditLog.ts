import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../lib/prisma';

export const auditLog = (action: string, resource?: string) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
      await prisma.auditLog.create({
        data: {
          userId: req.user?.userId,
          action,
          resource,
          details: { body: req.body, params: req.params, query: req.query },
          ip,
          userAgent: req.headers['user-agent'],
        },
      });
    } catch { /* non-blocking */ }
    next();
  };
};
