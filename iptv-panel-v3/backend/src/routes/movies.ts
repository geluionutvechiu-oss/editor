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
  const [movies, total] = await Promise.all([
    prisma.movie.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' }, include: { category: { select: { id: true, name: true } } } }),
    prisma.movie.count({ where }),
  ]);
  res.json({ data: movies, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const movie = await prisma.movie.findUnique({ where: { id: req.params.id }, include: { category: true } });
  if (!movie) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(movie);
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const movie = await prisma.movie.create({ data: req.body });
  res.status(201).json(movie);
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const movie = await prisma.movie.update({ where: { id: req.params.id }, data: req.body });
  res.json(movie);
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.movie.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// TMDB search proxy
router.get('/tmdb/search', async (req: AuthRequest, res: Response): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) { res.json({ results: [] }); return; }
  const resp = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(q)}`);
  const data = await resp.json() as any;
  res.json(data);
});

export default router;
