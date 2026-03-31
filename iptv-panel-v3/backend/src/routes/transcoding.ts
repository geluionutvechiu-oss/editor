import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const profiles = await prisma.transcodeProfile.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { streams: true } } } });
  res.json(profiles);
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const profile = await prisma.transcodeProfile.create({ data: req.body });
  res.status(201).json(profile);
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const profile = await prisma.transcodeProfile.update({ where: { id: req.params.id }, data: req.body });
  res.json(profile);
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.transcodeProfile.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
