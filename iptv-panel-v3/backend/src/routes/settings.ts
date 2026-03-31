import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendTestEmail } from '../services/emailService';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

router.get('/', async (_req, res: Response): Promise<void> => {
  const settings = await prisma.setting.findMany();
  const result: Record<string, unknown> = {};
  settings.forEach((s) => { result[s.key] = s.value; });
  res.json(result);
});

router.put('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.record(z.string(), z.unknown());
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid settings' }); return; }

  await Promise.all(
    Object.entries(parsed.data).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value: value as never }, create: { key, value: value as never } })
    )
  );
  res.json({ message: 'Settings saved' });
});

router.post('/smtp/test', async (req: AuthRequest, res: Response): Promise<void> => {
  const { to } = z.object({ to: z.string().email() }).parse(req.body);
  try {
    await sendTestEmail(to);
    res.json({ message: 'Test email sent' });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to send email' });
  }
});

router.post('/backup', async (_req, res: Response): Promise<void> => {
  const [users, clients, plans, servers, invoices, settings] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true, username: true, role: true, status: true, credits: true, createdAt: true } }),
    prisma.client.findMany(),
    prisma.plan.findMany(),
    prisma.server.findMany({ select: { id: true, name: true, url: true, type: true, location: true, createdAt: true } }),
    prisma.invoice.findMany(),
    prisma.setting.findMany(),
  ]);

  const backup = { exportedAt: new Date(), version: '1.0', data: { users, clients, plans, servers, invoices, settings } };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="iptv-backup-${Date.now()}.json"`);
  res.json(backup);
});

export default router;
