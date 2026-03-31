import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const epgs = await prisma.epgSource.findMany({ orderBy: { name: 'asc' } });
  res.json(epgs);
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const epg = await prisma.epgSource.create({ data: req.body });
  res.status(201).json(epg);
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const epg = await prisma.epgSource.update({ where: { id: req.params.id }, data: req.body });
  res.json(epg);
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.epgSource.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.post('/:id/fetch', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.epgSource.update({ where: { id: req.params.id }, data: { lastFetch: new Date() } });
  res.json({ success: true, message: 'EPG fetch triggered' });
});

export default router;
