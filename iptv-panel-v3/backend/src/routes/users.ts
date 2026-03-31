import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

const createSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'RESELLER', 'CLIENT']).default('RESELLER'),
  credits: z.number().default(0),
  resellerId: z.string().uuid().optional(),
});

// GET /api/users
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '25', search, role, status } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (search) where.OR = [{ email: { contains: search, mode: 'insensitive' } }, { username: { contains: search, mode: 'insensitive' } }];

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' }, select: { id: true, email: true, username: true, role: true, status: true, credits: true, twoFactorEnabled: true, resellerId: true, createdAt: true, _count: { select: { iptvClients: true } } } }),
    prisma.user.count({ where }),
  ]);
  res.json({ data: users, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
});

// POST /api/users
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { password, ...data } = parsed.data;
  const hashed = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findFirst({ where: { OR: [{ email: data.email }, { username: data.username }] } });
  if (existing) { res.status(409).json({ error: 'Email or username already exists' }); return; }

  const user = await prisma.user.create({ data: { ...data, password: hashed }, select: { id: true, email: true, username: true, role: true, status: true, credits: true, createdAt: true } });
  res.status(201).json(user);
});

// GET /api/users/:id
router.get('/:id', async (_req, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: _req.params.id }, select: { id: true, email: true, username: true, role: true, status: true, credits: true, twoFactorEnabled: true, resellerId: true, createdAt: true, _count: { select: { iptvClients: true } } } });
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(user);
});

// PUT /api/users/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = createSchema.partial().omit({ password: true }).extend({ password: z.string().min(6).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { password, ...data } = parsed.data;
  const updateData: Record<string, unknown> = { ...data };
  if (password) updateData.password = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({ where: { id: req.params.id }, data: updateData, select: { id: true, email: true, username: true, role: true, status: true, credits: true, createdAt: true } });
  res.json(user);
});

// DELETE /api/users/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ message: 'User deleted' });
});

// POST /api/users/:id/suspend
router.post('/:id/suspend', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'SUSPENDED' } });
  res.json(user);
});

// POST /api/users/:id/activate
router.post('/:id/activate', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'ACTIVE' } });
  res.json(user);
});

// POST /api/users/:id/credits
router.post('/:id/credits', async (req: AuthRequest, res: Response): Promise<void> => {
  const { amount, type } = z.object({ amount: z.number(), type: z.enum(['add', 'subtract']) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }

  const newCredits = type === 'add' ? user.credits + amount : Math.max(0, user.credits - amount);
  const updated = await prisma.user.update({ where: { id: req.params.id }, data: { credits: newCredits } });
  res.json({ credits: updated.credits });
});

// GET /api/users/:id/audit-logs
router.get('/:id/audit-logs', async (req: AuthRequest, res: Response): Promise<void> => {
  const logs = await prisma.auditLog.findMany({
    where: { userId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(logs);
});

export default router;
