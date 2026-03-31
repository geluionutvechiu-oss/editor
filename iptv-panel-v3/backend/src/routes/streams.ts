import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/streams - list with filter by category/status/search
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '50', search, status, categoryId, type } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;
  const [streams, total] = await Promise.all([
    prisma.stream.findMany({ where, skip, take: parseInt(limit), orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { category: { select: { id: true, name: true } }, transcodeProfile: { select: { id: true, name: true } } } }),
    prisma.stream.count({ where }),
  ]);
  res.json({ data: streams, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const stream = await prisma.stream.findUnique({ where: { id: req.params.id }, include: { category: true, transcodeProfile: true } });
  if (!stream) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(stream);
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const stream = await prisma.stream.create({ data: req.body });
  res.status(201).json(stream);
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const stream = await prisma.stream.update({ where: { id: req.params.id }, data: req.body });
  res.json(stream);
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.stream.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// GET /api/streams/stats/overview
router.get('/stats/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  const [total, online, offline, viewers] = await Promise.all([
    prisma.stream.count(),
    prisma.stream.count({ where: { status: 'ONLINE' } }),
    prisma.stream.count({ where: { status: 'OFFLINE' } }),
    prisma.stream.aggregate({ _sum: { currentViewers: true } }),
  ]);
  res.json({ total, online, offline, totalViewers: viewers._sum.currentViewers || 0 });
});

export default router;
