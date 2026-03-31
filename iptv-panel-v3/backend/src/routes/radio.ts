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
  const [radios, total] = await Promise.all([
    prisma.radioStream.findMany({ where, skip, take: parseInt(limit), orderBy: { name: 'asc' }, include: { category: { select: { id: true, name: true } } } }),
    prisma.radioStream.count({ where }),
  ]);
  res.json({ data: radios, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const radio = await prisma.radioStream.create({ data: req.body });
  res.status(201).json(radio);
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const radio = await prisma.radioStream.update({ where: { id: req.params.id }, data: req.body });
  res.json(radio);
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.radioStream.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
