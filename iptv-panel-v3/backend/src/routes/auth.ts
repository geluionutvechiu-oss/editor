import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import prisma from '../lib/prisma';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, getRefreshTokenExpiry } from '../lib/jwt';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

function getIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, password, totpCode } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (user.status === 'SUSPENDED') { res.status(403).json({ error: 'Account suspended' }); return; }

  if (user.twoFactorEnabled) {
    if (!totpCode) { res.status(200).json({ requires2FA: true }); return; }
    if (!user.twoFactorSecret || !authenticator.verify({ token: totpCode, secret: user.twoFactorSecret })) {
      res.status(401).json({ error: 'Invalid 2FA code' }); return;
    }
  }

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      token: generateAccessToken({ userId: user.id, email: user.email, role: user.role }),
      ip: getIp(req),
      userAgent: req.headers['user-agent'],
      device: req.headers['user-agent']?.split(' ')[0] || 'Unknown',
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role, sessionId: session.id });
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email, role: user.role, sessionId: session.id });

  await prisma.session.update({ where: { id: session.id }, data: { token: accessToken, refreshToken } });

  await prisma.auditLog.create({
    data: { userId: user.id, action: 'LOGIN', resource: 'session', ip: getIp(req), userAgent: req.headers['user-agent'] },
  });

  const { password: _p, twoFactorSecret: _s, ...safeUser } = user;
  res.json({ user: safeUser, accessToken, refreshToken });
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionId = req.user?.sessionId;
  if (sessionId) await prisma.session.deleteMany({ where: { id: sessionId } });
  res.json({ message: 'Logged out' });
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) { res.status(400).json({ error: 'Refresh token required' }); return; }
  try {
    const payload = verifyRefreshToken(refreshToken);
    const session = await prisma.session.findFirst({ where: { refreshToken, userId: payload.userId } });
    if (!session || session.expiresAt < new Date()) { res.status(401).json({ error: 'Session expired' }); return; }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status === 'SUSPENDED') { res.status(403).json({ error: 'Account inactive' }); return; }

    const newAccess = generateAccessToken({ userId: user.id, email: user.email, role: user.role, sessionId: session.id });
    const newRefresh = generateRefreshToken({ userId: user.id, email: user.email, role: user.role, sessionId: session.id });

    await prisma.session.update({ where: { id: session.id }, data: { token: newAccess, refreshToken: newRefresh, lastActive: new Date() } });

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, username: true, role: true, status: true, twoFactorEnabled: true, credits: true, resellerId: true, createdAt: true },
  });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

// GET /api/auth/sessions
router.get('/sessions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user!.userId, expiresAt: { gt: new Date() } },
    orderBy: { lastActive: 'desc' },
  });
  res.json(sessions);
});

// DELETE /api/auth/sessions/:id
router.delete('/sessions/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.session.deleteMany({ where: { id: req.params.id, userId: req.user!.userId } });
  res.json({ message: 'Session terminated' });
});

// POST /api/auth/2fa/setup
router.post('/2fa/setup', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }

  const secret = authenticator.generateSecret();
  const otpAuth = authenticator.keyuri(user.email, 'IPTV Panel', secret);
  const qrCode = await QRCode.toDataURL(otpAuth);

  // Save secret temporarily (not enabled until verified)
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });

  res.json({ secret, qrCode, otpAuth });
});

// POST /api/auth/2fa/enable
router.post('/2fa/enable', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user?.twoFactorSecret) { res.status(400).json({ error: '2FA not set up' }); return; }

  if (!authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
    res.status(400).json({ error: 'Invalid code' }); return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  res.json({ message: '2FA enabled' });
});

// POST /api/auth/2fa/disable
router.post('/2fa/disable', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { code } = z.object({ code: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user?.twoFactorSecret) { res.status(400).json({ error: '2FA not enabled' }); return; }

  if (!authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
    res.status(400).json({ error: 'Invalid code' }); return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  res.json({ message: '2FA disabled' });
});

export default router;
