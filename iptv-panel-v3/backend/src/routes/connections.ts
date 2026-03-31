import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/connections - active connections (last 5 min)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const { page = '1', limit = '50', search } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = { lastSeen: { gte: fiveMinAgo } };
  if (search) where.username = { contains: search, mode: 'insensitive' };
  const [connections, total] = await Promise.all([
    prisma.liveConnection.findMany({ where, skip, take: parseInt(limit), orderBy: { lastSeen: 'desc' } }),
    prisma.liveConnection.count({ where }),
  ]);
  res.json({ data: connections, total, page: parseInt(page), limit: parseInt(limit) });
});

// POST /api/connections - register a connection (called by streaming server)
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const conn = await prisma.liveConnection.upsert({
    where: { id: req.body.id || '' },
    update: { lastSeen: new Date(), bandwidth: req.body.bandwidth || 0 },
    create: { ...req.body, connectedAt: new Date(), lastSeen: new Date() },
  });
  res.json(conn);
});

// DELETE /api/connections/:id - kill connection
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.liveConnection.delete({ where: { id: req.params.id } }).catch(() => {});
  res.json({ success: true });
});

// GET /api/connections/stats
router.get('/stats/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const [total, byCountry, bandwidth] = await Promise.all([
    prisma.liveConnection.count({ where: { lastSeen: { gte: fiveMinAgo } } }),
    prisma.liveConnection.groupBy({ by: ['country'], where: { lastSeen: { gte: fiveMinAgo } }, _count: true, orderBy: { _count: { country: 'desc' } }, take: 10 }),
    prisma.liveConnection.aggregate({ where: { lastSeen: { gte: fiveMinAgo } }, _sum: { bandwidth: true } }),
  ]);
  res.json({ total, byCountry, totalBandwidth: bandwidth._sum.bandwidth || 0 });
});

export default router;
