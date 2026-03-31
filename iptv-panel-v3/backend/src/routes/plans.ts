import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  durationDays: z.number().int().min(1),
  maxConnections: z.number().int().min(1).default(1),
  price: z.number().min(0),
  bouquets: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

router.get('/', async (_req, res: Response): Promise<void> => {
  const plans = await prisma.plan.findMany({ orderBy: { price: 'asc' }, include: { _count: { select: { clients: true } } } });
  res.json(plans);
});

router.post('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const plan = await prisma.plan.create({ data: parsed.data });
  res.status(201).json(plan);
});

router.put('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const plan = await prisma.plan.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(plan);
});

router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.plan.delete({ where: { id: req.params.id } });
  res.json({ message: 'Plan deleted' });
});

export default router;
