import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '25', unread } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: Record<string, unknown> = { userId: req.user!.userId };
  if (unread === 'true') where.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user!.userId, read: false } }),
  ]);
  res.json({ data: notifications, total, unreadCount, pages: Math.ceil(total / parseInt(limit)) });
});

router.post('/mark-read', async (req: AuthRequest, res: Response): Promise<void> => {
  const { ids } = z.object({ ids: z.array(z.string()) }).parse(req.body);
  await prisma.notification.updateMany({ where: { id: { in: ids }, userId: req.user!.userId }, data: { read: true } });
  res.json({ message: 'Marked as read' });
});

router.post('/mark-all-read', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.notification.updateMany({ where: { userId: req.user!.userId, read: false }, data: { read: true } });
  res.json({ message: 'All marked as read' });
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.notification.deleteMany({ where: { id: req.params.id, userId: req.user!.userId } });
  res.json({ message: 'Deleted' });
});

export default router;
