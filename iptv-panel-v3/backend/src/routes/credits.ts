import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/logs', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '25', userId } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (userId) where.userId = userId;
  else if (req.user!.role !== 'ADMIN') where.userId = req.user!.userId;
  const [logs, total] = await Promise.all([
    prisma.creditLog.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
    prisma.creditLog.count({ where }),
  ]);
  res.json({ data: logs, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/add', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { userId, amount, description } = req.body;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  const balanceBefore = user.credits;
  const balanceAfter = balanceBefore + amount;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { credits: balanceAfter } }),
    prisma.creditLog.create({ data: { userId, amount, type: amount > 0 ? 'ADD' : 'DEDUCT', description, balanceBefore, balanceAfter } }),
  ]);
  res.json({ success: true, newBalance: balanceAfter });
});

export default router;
