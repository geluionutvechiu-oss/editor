import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '25', status, priority } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
    prisma.supportTicket.count({ where }),
  ]);
  res.json({ data: tickets, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const t = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!t) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(t);
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const t = await prisma.supportTicket.create({ data: req.body });
  res.status(201).json(t);
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const t = await prisma.supportTicket.update({ where: { id: req.params.id }, data: req.body });
  res.json(t);
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.supportTicket.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.post('/:id/respond', async (req: AuthRequest, res: Response): Promise<void> => {
  const t = await prisma.supportTicket.update({ where: { id: req.params.id }, data: { response: req.body.response, status: 'IN_PROGRESS', assignedTo: req.user!.userId } });
  res.json(t);
});

router.post('/:id/resolve', async (req: AuthRequest, res: Response): Promise<void> => {
  const t = await prisma.supportTicket.update({ where: { id: req.params.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
  res.json(t);
});

export default router;
