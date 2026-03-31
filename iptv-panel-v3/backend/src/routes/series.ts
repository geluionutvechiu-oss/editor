import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '25', search, categoryId } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (categoryId) where.categoryId = categoryId;
  const [series, total] = await Promise.all([
    prisma.series.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' }, include: { category: { select: { id: true, name: true } }, _count: { select: { episodes: true } } } }),
    prisma.series.count({ where }),
  ]);
  res.json({ data: series, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const s = await prisma.series.findUnique({ where: { id: req.params.id }, include: { category: true, episodes: { orderBy: [{ season: 'asc' }, { episode: 'asc' }] } } });
  if (!s) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(s);
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { episodes: _, ...data } = req.body;
  const s = await prisma.series.create({ data });
  res.status(201).json(s);
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { episodes: _, ...data } = req.body;
  const s = await prisma.series.update({ where: { id: req.params.id }, data });
  res.json(s);
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.series.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Episodes CRUD
router.get('/:id/episodes', async (req: AuthRequest, res: Response): Promise<void> => {
  const episodes = await prisma.episode.findMany({ where: { seriesId: req.params.id }, orderBy: [{ season: 'asc' }, { episode: 'asc' }] });
  res.json(episodes);
});

router.post('/:id/episodes', async (req: AuthRequest, res: Response): Promise<void> => {
  const ep = await prisma.episode.create({ data: { ...req.body, seriesId: req.params.id } });
  res.status(201).json(ep);
});

router.put('/:id/episodes/:epId', async (req: AuthRequest, res: Response): Promise<void> => {
  const ep = await prisma.episode.update({ where: { id: req.params.epId }, data: req.body });
  res.json(ep);
});

router.delete('/:id/episodes/:epId', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.episode.delete({ where: { id: req.params.epId } });
  res.json({ success: true });
});

export default router;
