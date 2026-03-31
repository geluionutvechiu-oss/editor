import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { type } = req.query as Record<string, string>;
  const where: any = {};
  if (type) where.type = type;
  const cats = await prisma.streamCategory.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { streams: true, movies: true, series: true, radios: true } } } });
  res.json(cats);
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const cat = await prisma.streamCategory.create({ data: req.body });
  res.status(201).json(cat);
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const cat = await prisma.streamCategory.update({ where: { id: req.params.id }, data: req.body });
  res.json(cat);
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.streamCategory.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
