import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Firewall Rules
router.get('/firewall', async (_req, res: Response): Promise<void> => {
  const rules = await prisma.firewallRule.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(rules);
});

router.post('/firewall', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ type: z.enum(['WHITELIST', 'BLACKLIST']), value: z.string().min(1), reason: z.string().optional(), expiresAt: z.string().datetime().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const rule = await prisma.firewallRule.upsert({
    where: { type_value: { type: parsed.data.type, value: parsed.data.value } },
    update: { reason: parsed.data.reason, expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null },
    create: { ...parsed.data, expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null, createdBy: req.user!.userId },
  });
  res.status(201).json(rule);
});

router.delete('/firewall/:id', requireRole('ADMIN'), async (_req, res: Response): Promise<void> => {
  await prisma.firewallRule.delete({ where: { id: _req.params.id } });
  res.json({ message: 'Rule deleted' });
});

// Sharing Alerts
router.get('/sharing-alerts', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { resolved: false };
  const alerts = await prisma.sharingAlert.findMany({ where, orderBy: { createdAt: 'desc' }, include: { client: { select: { username: true, ownerId: true } } } });
  if (req.user!.role !== 'ADMIN') {
    const filtered = alerts.filter((a) => a.client.ownerId === req.user!.userId);
    res.json(filtered); return;
  }
  res.json(alerts);
});

router.post('/sharing-alerts/:id/resolve', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.sharingAlert.update({ where: { id: req.params.id }, data: { resolved: true } });
  res.json({ message: 'Resolved' });
});

// API Keys
router.get('/api-keys', async (req: AuthRequest, res: Response): Promise<void> => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.user!.userId },
    select: { id: true, name: true, key: true, permissions: true, isActive: true, lastUsed: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(keys);
});

router.post('/api-keys', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, permissions, expiresAt } = z.object({
    name: z.string().min(1),
    permissions: z.array(z.string()).default(['read']),
    expiresAt: z.string().datetime().optional(),
  }).parse(req.body);

  const key = `iptv_${crypto.randomBytes(32).toString('hex')}`;
  const apiKey = await prisma.apiKey.create({
    data: { userId: req.user!.userId, name, key, permissions, expiresAt: expiresAt ? new Date(expiresAt) : null },
  });
  res.status(201).json(apiKey);
});

router.delete('/api-keys/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.apiKey.deleteMany({ where: { id: req.params.id, userId: req.user!.userId } });
  res.json({ message: 'API key revoked' });
});

// Sessions (for security page)
router.get('/sessions', async (req: AuthRequest, res: Response): Promise<void> => {
  const where = req.user!.role === 'ADMIN' ? {} : { userId: req.user!.userId };
  const sessions = await prisma.session.findMany({ where, orderBy: { lastActive: 'desc' }, include: { user: { select: { username: true, email: true } } } });
  res.json(sessions);
});

router.delete('/sessions/:id', requireRole('ADMIN'), async (_req, res: Response): Promise<void> => {
  await prisma.session.delete({ where: { id: _req.params.id } });
  res.json({ message: 'Session killed' });
});

// Geo-blocking stored as settings
router.get('/geo-blocking', async (_req, res: Response): Promise<void> => {
  const setting = await prisma.setting.findUnique({ where: { key: 'geo_blocking' } });
  res.json((setting?.value as Record<string, unknown>) || { enabled: false, blockedCountries: [] });
});

router.post('/geo-blocking', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const data = z.object({ enabled: z.boolean(), blockedCountries: z.array(z.string()) }).parse(req.body);
  const setting = await prisma.setting.upsert({
    where: { key: 'geo_blocking' },
    update: { value: data },
    create: { key: 'geo_blocking', value: data },
  });
  res.json(setting.value);
});

export default router;
