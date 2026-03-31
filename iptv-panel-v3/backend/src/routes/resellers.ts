import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

router.get('/', async (_req, res: Response): Promise<void> => {
  const resellers = await prisma.user.findMany({
    where: { role: 'RESELLER' },
    select: { id: true, email: true, username: true, status: true, credits: true, createdAt: true, _count: { select: { iptvClients: true, clients: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(resellers);
});

router.get('/hierarchy', async (_req, res: Response): Promise<void> => {
  const resellers = await prisma.user.findMany({
    where: { role: 'RESELLER', resellerId: null },
    include: { clients: { include: { clients: true } } },
  });
  res.json(resellers);
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    email: z.string().email(),
    username: z.string().min(3),
    password: z.string().min(6),
    credits: z.number().default(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const reseller = await prisma.user.create({
    data: { ...parsed.data, password: hashed, role: 'RESELLER' },
    select: { id: true, email: true, username: true, role: true, credits: true, createdAt: true },
  });
  res.status(201).json(reseller);
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ email: z.string().email().optional(), username: z.string().optional(), status: z.enum(['ACTIVE', 'SUSPENDED']).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const reseller = await prisma.user.update({ where: { id: req.params.id, role: 'RESELLER' }, data: parsed.data });
  res.json(reseller);
});

router.get('/:id/clients', async (req: AuthRequest, res: Response): Promise<void> => {
  const clients = await prisma.client.findMany({ where: { ownerId: req.params.id }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
  res.json(clients);
});

router.post('/:id/credits', async (req: AuthRequest, res: Response): Promise<void> => {
  const { amount, type } = z.object({ amount: z.number().positive(), type: z.enum(['add', 'subtract']) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }
  const newCredits = type === 'add' ? user.credits + amount : Math.max(0, user.credits - amount);
  const updated = await prisma.user.update({ where: { id: req.params.id }, data: { credits: newCredits } });
  res.json({ credits: updated.credits });
});

export default router;
