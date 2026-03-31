import { Router, Response } from 'express';
import { z } from 'zod';
import https from 'https';
import http from 'http';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  type: z.enum(['XTREAM', 'STALKER', 'M3U']).default('XTREAM'),
  username: z.string().optional(),
  password: z.string().optional(),
  location: z.string().optional(),
  maxStreams: z.number().int().min(1).default(1000),
});

router.get('/', async (_req, res: Response): Promise<void> => {
  const servers = await prisma.server.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { clients: true } } } });
  res.json(servers);
});

router.post('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const server = await prisma.server.create({ data: parsed.data });
  res.status(201).json(server);
});

router.put('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const server = await prisma.server.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(server);
});

router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.server.delete({ where: { id: req.params.id } });
  res.json({ message: 'Server deleted' });
});

router.get('/:id/health', async (req: AuthRequest, res: Response): Promise<void> => {
  const server = await prisma.server.findUnique({ where: { id: req.params.id } });
  if (!server) { res.status(404).json({ error: 'Not found' }); return; }

  const start = Date.now();
  try {
    await new Promise<void>((resolve, reject) => {
      const protocol = server.url.startsWith('https') ? https : http;
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
      const req = protocol.get(server.url, (r) => { clearTimeout(timeout); r.destroy(); resolve(); });
      req.on('error', (e) => { clearTimeout(timeout); reject(e); });
    });
    const latency = Date.now() - start;
    const newStatus = latency < 2000 ? 'ONLINE' : 'DEGRADED';
    await prisma.server.update({ where: { id: server.id }, data: { status: newStatus, lastChecked: new Date(), uptime: 99.5 } });
    res.json({ status: newStatus, latency, checkedAt: new Date() });
  } catch {
    await prisma.server.update({ where: { id: server.id }, data: { status: 'OFFLINE', lastChecked: new Date() } });
    res.json({ status: 'OFFLINE', latency: null, checkedAt: new Date() });
  }
});

router.post('/:id/test-stream', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { streamUrl } = z.object({ streamUrl: z.string().url() }).parse(req.body);
  const start = Date.now();
  try {
    await new Promise<void>((resolve, reject) => {
      const protocol = streamUrl.startsWith('https') ? https : http;
      const timeout = setTimeout(() => reject(new Error('timeout')), 8000);
      const r = protocol.get(streamUrl, (resp) => { clearTimeout(timeout); resp.destroy(); resolve(); });
      r.on('error', (e) => { clearTimeout(timeout); reject(e); });
    });
    res.json({ alive: true, latency: Date.now() - start });
  } catch (e: unknown) {
    res.json({ alive: false, error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

export default router;
