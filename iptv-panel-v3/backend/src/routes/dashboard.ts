import { Router, Response } from 'express';
import { subDays, startOfDay, format } from 'date-fns';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  const isAdmin = req.user!.role === 'ADMIN';
  const ownerId = isAdmin ? undefined : req.user!.userId;

  const clientWhere = ownerId ? { ownerId } : {};

  const [totalClients, activeClients, suspendedClients, expiredClients, expiringClients, totalRevenue, totalResellers, servers] = await Promise.all([
    prisma.client.count({ where: clientWhere }),
    prisma.client.count({ where: { ...clientWhere, status: 'ACTIVE' } }),
    prisma.client.count({ where: { ...clientWhere, status: 'SUSPENDED' } }),
    prisma.client.count({ where: { ...clientWhere, status: 'EXPIRED' } }),
    prisma.client.count({ where: { ...clientWhere, status: 'ACTIVE', expiresAt: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), gt: new Date() } } }),
    prisma.invoice.aggregate({ where: { status: 'PAID', ...(ownerId ? { userId: ownerId } : {}) }, _sum: { amount: true } }),
    isAdmin ? prisma.user.count({ where: { role: 'RESELLER' } }) : 0,
    prisma.server.findMany({ select: { id: true, name: true, status: true, activeStreams: true, maxStreams: true, uptime: true, bandwidthMbps: true } }),
  ]);

  // MRR: sum of paid invoices this month / count of paid clients
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthRevenue = await prisma.invoice.aggregate({ where: { status: 'PAID', createdAt: { gte: startOfMonth }, ...(ownerId ? { userId: ownerId } : {}) }, _sum: { amount: true } });

  res.json({
    clients: { total: totalClients, active: activeClients, suspended: suspendedClients, expired: expiredClients, expiringSoon: expiringClients },
    revenue: { total: totalRevenue._sum.amount || 0, mrr: monthRevenue._sum.amount || 0, arr: (monthRevenue._sum.amount || 0) * 12 },
    resellers: totalResellers,
    servers,
  });
});

router.get('/chart-data', async (req: AuthRequest, res: Response): Promise<void> => {
  const ownerId = req.user!.role !== 'ADMIN' ? req.user!.userId : undefined;
  const clientWhere = ownerId ? { ownerId } : {};

  const last30Days = Array.from({ length: 30 }, (_, i) => subDays(new Date(), 29 - i));

  const clientsByDay = await Promise.all(
    last30Days.map(async (day) => {
      const start = startOfDay(day);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const count = await prisma.client.count({ where: { ...clientWhere, createdAt: { gte: start, lt: end } } });
      return { date: format(day, 'MMM dd'), count };
    })
  );

  // Revenue last 6 months
  const revenueByMonth = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return d;
    }).map(async (month) => {
      const start = new Date(month.getFullYear(), month.getMonth(), 1);
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      const result = await prisma.invoice.aggregate({ where: { status: 'PAID', createdAt: { gte: start, lt: end }, ...(ownerId ? { userId: ownerId } : {}) }, _sum: { amount: true } });
      return { month: format(month, 'MMM yyyy'), revenue: result._sum.amount || 0 };
    })
  );

  res.json({ clientsByDay, revenueByMonth });
});

router.get('/audit-logs', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '50', userId, action, from, to } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: Record<string, unknown> = {};
  if (req.user!.role !== 'ADMIN') where.userId = req.user!.userId;
  else if (userId) where.userId = userId;
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (from || to) where.createdAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' }, include: { user: { select: { username: true, email: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({ data: logs, total, pages: Math.ceil(total / parseInt(limit)) });
});

export default router;
