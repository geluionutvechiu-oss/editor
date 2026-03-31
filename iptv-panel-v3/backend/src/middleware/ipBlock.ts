import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export const ipBlockMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  try {
    const blocked = await prisma.firewallRule.findFirst({
      where: { type: 'BLACKLIST', value: ip, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    if (blocked) { res.status(403).json({ error: 'Access denied' }); return; }
  } catch { /* don't block on DB error */ }
  next();
};
