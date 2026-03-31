import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { generateAllFormats, generateM3UUrl } from '../services/credentialService';

const router = Router();
router.use(authenticate);

function randomPassword(len = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const createSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  password: z.string().min(4).optional(),
  planId: z.string().uuid().optional(),
  serverId: z.string().uuid().optional(),
  expiresAt: z.string().datetime(),
  maxConnections: z.number().int().min(1).max(100).default(1),
  bouquets: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial().omit({ username: true });

// GET /api/clients
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '25', search, status, planId } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: Record<string, unknown> = {};
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;
  if (status) where.status = status;
  if (planId) where.planId = planId;
  if (search) where.username = { contains: search, mode: 'insensitive' };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { id: true, name: true } }, server: { select: { id: true, name: true } } },
    }),
    prisma.client.count({ where }),
  ]);

  res.json({ data: clients, total, page: parseInt(page as string), limit: parseInt(limit as string), pages: Math.ceil(total / parseInt(limit as string)) });
});

// POST /api/clients
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const data = parsed.data;
  const username = data.username || `user_${uuidv4().slice(0, 8)}`;
  const rawPassword = data.password || randomPassword();

  // Get server for URL generation
  let xtreamHost = process.env.DEFAULT_SERVER_URL || 'http://your-server.com';
  if (data.serverId) {
    const srv = await prisma.server.findUnique({ where: { id: data.serverId } });
    if (srv) xtreamHost = srv.url;
  }

  const m3uUrl = generateM3UUrl({ username, password: rawPassword, m3uUrl: '', xtreamHost });

  const client = await prisma.client.create({
    data: {
      username,
      password: rawPassword, // Store plain for IPTV use
      m3uUrl,
      xtreamHost,
      expiresAt: new Date(data.expiresAt),
      maxConnections: data.maxConnections,
      bouquets: data.bouquets,
      notes: data.notes,
      ownerId: req.user!.userId,
      serverId: data.serverId,
      planId: data.planId,
    },
    include: { plan: true, server: true },
  });

  await prisma.auditLog.create({
    data: { userId: req.user!.userId, action: 'CREATE_CLIENT', resource: 'client', details: { clientId: client.id, username } },
  });

  const credentials = await generateAllFormats({ username: client.username, password: client.password, m3uUrl: client.m3uUrl || '', xtreamHost: client.xtreamHost || xtreamHost });
  res.status(201).json({ client, credentials });
});

// GET /api/clients/export
router.get('/export', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = {};
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;

  const clients = await prisma.client.findMany({ where, include: { plan: true } });

  const csv = [
    'Username,Password,Status,Expiry,Max Connections,Plan,M3U URL',
    ...clients.map((c) => `${c.username},${c.password},${c.status},${c.expiresAt.toISOString()},${c.maxConnections},${c.plan?.name || ''},${c.m3uUrl || ''}`),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
  res.send(csv);
});

// GET /api/clients/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;

  const client = await prisma.client.findFirst({ where, include: { plan: true, server: true, invoices: { orderBy: { createdAt: 'desc' }, take: 5 } } });
  if (!client) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(client);
});

// PUT /api/clients/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;

  const existing = await prisma.client.findFirst({ where });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const { password: newPass, serverId, expiresAt, ...rest } = parsed.data;

  const updateData: Record<string, unknown> = { ...rest };
  if (newPass) updateData.password = newPass;
  if (expiresAt) updateData.expiresAt = new Date(expiresAt);
  if (serverId !== undefined) {
    updateData.serverId = serverId;
    if (serverId) {
      const srv = await prisma.server.findUnique({ where: { id: serverId } });
      if (srv) {
        updateData.xtreamHost = srv.url;
        updateData.m3uUrl = generateM3UUrl({ username: existing.username, password: newPass || existing.password, m3uUrl: '', xtreamHost: srv.url });
      }
    }
  }

  const client = await prisma.client.update({ where: { id: req.params.id }, data: updateData, include: { plan: true, server: true } });
  res.json(client);
});

// DELETE /api/clients/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;

  const existing = await prisma.client.findFirst({ where });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  await prisma.client.delete({ where: { id: req.params.id } });
  await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'DELETE_CLIENT', resource: 'client', details: { username: existing.username } } });
  res.json({ message: 'Deleted' });
});

// POST /api/clients/:id/suspend
router.post('/:id/suspend', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;
  const client = await prisma.client.findFirst({ where });
  if (!client) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = await prisma.client.update({ where: { id: req.params.id }, data: { status: 'SUSPENDED' } });
  res.json(updated);
});

// POST /api/clients/:id/activate
router.post('/:id/activate', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;
  const client = await prisma.client.findFirst({ where });
  if (!client) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = await prisma.client.update({ where: { id: req.params.id }, data: { status: 'ACTIVE' } });
  res.json(updated);
});

// POST /api/clients/:id/renew
router.post('/:id/renew', async (req: AuthRequest, res: Response): Promise<void> => {
  const { days } = z.object({ days: z.number().int().min(1) }).parse(req.body);
  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;

  const client = await prisma.client.findFirst({ where });
  if (!client) { res.status(404).json({ error: 'Not found' }); return; }

  const baseDate = client.expiresAt > new Date() ? client.expiresAt : new Date();
  const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

  const updated = await prisma.client.update({ where: { id: req.params.id }, data: { expiresAt: newExpiry, status: 'ACTIVE' } });
  res.json(updated);
});

// GET /api/clients/:id/credentials
router.get('/:id/credentials', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;

  const client = await prisma.client.findFirst({ where, include: { server: true } });
  if (!client) { res.status(404).json({ error: 'Not found' }); return; }

  const xtreamHost = client.xtreamHost || client.server?.url || process.env.DEFAULT_SERVER_URL || 'http://your-server.com';
  const credentials = await generateAllFormats({ username: client.username, password: client.password, m3uUrl: client.m3uUrl || '', xtreamHost });
  res.json(credentials);
});

// POST /api/clients/:id/stop-connection
router.post('/:id/stop-connection', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;
  const client = await prisma.client.findFirst({ where });
  if (!client) { res.status(404).json({ error: 'Not found' }); return; }

  await prisma.liveConnection.deleteMany({ where: { clientId: req.params.id } });
  res.json({ message: 'Connection stopped' });
});

// POST /api/clients/:id/reset-blocks
router.post('/:id/reset-blocks', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) { res.status(404).json({ error: 'Not found' }); return; }

  // Delete IpBlock records for this client's current IP if known
  if (client.currentIp) {
    await prisma.ipBlock.deleteMany({ where: { value: client.currentIp } });
  }
  await prisma.client.update({ where: { id: req.params.id }, data: { blocksCount: 0 } });
  res.json({ message: 'Blocks reset' });
});

// GET /api/clients/:id/connection-history
router.get('/:id/connection-history', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;
  const client = await prisma.client.findFirst({ where });
  if (!client) { res.status(404).json({ error: 'Not found' }); return; }

  const logs = await prisma.connectionLog.findMany({
    where: { clientId: req.params.id },
    orderBy: { connectedAt: 'desc' },
    take: 100,
  });
  res.json(logs);
});

// GET /api/clients/:id/download
router.get('/:id/download', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;
  const client = await prisma.client.findFirst({ where, include: { server: true } });
  if (!client) { res.status(404).json({ error: 'Not found' }); return; }

  const xtreamHost = client.xtreamHost || client.server?.url || process.env.DEFAULT_SERVER_URL || 'http://your-server.com';
  const credentials = {
    username: client.username,
    password: client.password,
    m3uUrl: client.m3uUrl || `${xtreamHost}/get.php?username=${client.username}&password=${client.password}&type=m3u_plus`,
    xtreamHost,
    expiresAt: client.expiresAt,
    maxConnections: client.maxConnections,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${client.username}-credentials.json"`);
  res.json(credentials);
});

// POST /api/clients/bulk
router.post('/bulk', async (req: AuthRequest, res: Response): Promise<void> => {
  const { ids, action, days } = z.object({
    ids: z.array(z.string().uuid()),
    action: z.enum(['suspend', 'activate', 'delete', 'renew']),
    days: z.number().optional(),
  }).parse(req.body);

  const where: Record<string, unknown> = { id: { in: ids } };
  if (req.user!.role !== 'ADMIN') where.ownerId = req.user!.userId;

  if (action === 'delete') {
    await prisma.client.deleteMany({ where });
  } else if (action === 'suspend') {
    await prisma.client.updateMany({ where, data: { status: 'SUSPENDED' } });
  } else if (action === 'activate') {
    await prisma.client.updateMany({ where, data: { status: 'ACTIVE' } });
  } else if (action === 'renew' && days) {
    const clients = await prisma.client.findMany({ where });
    await Promise.all(clients.map((c) => {
      const base = c.expiresAt > new Date() ? c.expiresAt : new Date();
      const newExpiry = new Date(base.getTime() + (days || 30) * 24 * 60 * 60 * 1000);
      return prisma.client.update({ where: { id: c.id }, data: { expiresAt: newExpiry, status: 'ACTIVE' } });
    }));
  }

  res.json({ message: `Bulk ${action} applied to ${ids.length} clients` });
});

export default router;
