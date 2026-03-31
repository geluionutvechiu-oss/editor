import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { lookupIp } from '../services/geoService';

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

// IP Blocks
router.get('/ip-blocks', async (_req, res: Response): Promise<void> => {
  const blocks = await prisma.ipBlock.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(blocks);
});

router.post('/ip-blocks', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    value: z.string().min(1),
    reason: z.string().optional(),
    blockType: z.enum(['IP', 'CIDR', 'ASN', 'COUNTRY', 'ISP']).default('IP'),
    expiresAt: z.string().datetime().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const block = await prisma.ipBlock.create({
    data: {
      value: parsed.data.value,
      reason: parsed.data.reason,
      blockType: parsed.data.blockType,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdBy: req.user!.userId,
    },
  });
  res.status(201).json(block);
});

router.delete('/ip-blocks/:id', requireRole('ADMIN'), async (_req, res: Response): Promise<void> => {
  await prisma.ipBlock.delete({ where: { id: _req.params.id } });
  res.json({ message: 'IP block deleted' });
});

// ASN Blocks
router.get('/asn-blocks', async (_req, res: Response): Promise<void> => {
  const blocks = await prisma.asnBlock.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(blocks);
});

router.post('/asn-blocks', requireRole('ADMIN'), async (_req, res: Response): Promise<void> => {
  const schema = z.object({ asn: z.string().min(1), asnName: z.string().optional(), reason: z.string().optional() });
  const parsed = schema.safeParse(_req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const block = await prisma.asnBlock.create({ data: parsed.data });
  res.status(201).json(block);
});

router.delete('/asn-blocks/:id', requireRole('ADMIN'), async (_req, res: Response): Promise<void> => {
  await prisma.asnBlock.delete({ where: { id: _req.params.id } });
  res.json({ message: 'ASN block deleted' });
});

// Country Blocks
router.get('/country-blocks', async (_req, res: Response): Promise<void> => {
  const blocks = await prisma.countryBlock.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(blocks);
});

router.post('/country-blocks', requireRole('ADMIN'), async (_req, res: Response): Promise<void> => {
  const schema = z.object({ countryCode: z.string().length(2), countryName: z.string().optional(), reason: z.string().optional() });
  const parsed = schema.safeParse(_req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const block = await prisma.countryBlock.create({ data: { ...parsed.data, countryCode: parsed.data.countryCode.toUpperCase() } });
  res.status(201).json(block);
});

router.delete('/country-blocks/:id', requireRole('ADMIN'), async (_req, res: Response): Promise<void> => {
  await prisma.countryBlock.delete({ where: { id: _req.params.id } });
  res.json({ message: 'Country block deleted' });
});

// ISP Blocks
router.get('/isp-blocks', async (_req, res: Response): Promise<void> => {
  const blocks = await prisma.ispBlock.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(blocks);
});

router.post('/isp-blocks', requireRole('ADMIN'), async (_req, res: Response): Promise<void> => {
  const schema = z.object({ ispName: z.string().min(1), reason: z.string().optional() });
  const parsed = schema.safeParse(_req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const block = await prisma.ispBlock.create({ data: parsed.data });
  res.status(201).json(block);
});

router.delete('/isp-blocks/:id', requireRole('ADMIN'), async (_req, res: Response): Promise<void> => {
  await prisma.ispBlock.delete({ where: { id: _req.params.id } });
  res.json({ message: 'ISP block deleted' });
});

// Geo Lookup
router.get('/geo-lookup', async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = req.query.ip as string;
  if (!ip) { res.status(400).json({ error: 'ip query param required' }); return; }
  const info = lookupIp(ip);
  if (!info) { res.status(404).json({ error: 'No geo data for this IP' }); return; }
  res.json(info);
});

// Live Map
router.get('/live-map', async (_req, res: Response): Promise<void> => {
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const liveConns = await prisma.liveConnection.findMany({
    where: { lastSeen: { gte: since } },
    take: 500,
  });

  const connections = liveConns.map(conn => {
    const geo = lookupIp(conn.ipAddress);
    return {
      ip: conn.ipAddress,
      lat: geo?.ll[0] ?? 0,
      lon: geo?.ll[1] ?? 0,
      country: geo?.country || conn.country || '',
      username: conn.username,
      streamName: conn.streamName || '',
    };
  });

  res.json({ connections });
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
