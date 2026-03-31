import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// MAG Devices
router.get('/mag', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '25', search } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (search) where.macAddress = { contains: search, mode: 'insensitive' };
  const [devices, total] = await Promise.all([
    prisma.magDevice.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' }, include: { client: { select: { id: true, username: true } } } }),
    prisma.magDevice.count({ where }),
  ]);
  res.json({ data: devices, total });
});

router.post('/mag', async (req: AuthRequest, res: Response): Promise<void> => {
  const d = await prisma.magDevice.create({ data: req.body });
  res.status(201).json(d);
});

router.put('/mag/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const d = await prisma.magDevice.update({ where: { id: req.params.id }, data: req.body });
  res.json(d);
});

router.delete('/mag/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.magDevice.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Enigma2 Devices
router.get('/enigma2', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '25', search } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (search) where.macAddress = { contains: search, mode: 'insensitive' };
  const [devices, total] = await Promise.all([
    prisma.enigma2Device.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' }, include: { client: { select: { id: true, username: true } } } }),
    prisma.enigma2Device.count({ where }),
  ]);
  res.json({ data: devices, total });
});

router.post('/enigma2', async (req: AuthRequest, res: Response): Promise<void> => {
  const d = await prisma.enigma2Device.create({ data: req.body });
  res.status(201).json(d);
});

router.put('/enigma2/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const d = await prisma.enigma2Device.update({ where: { id: req.params.id }, data: req.body });
  res.json(d);
});

router.delete('/enigma2/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.enigma2Device.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
