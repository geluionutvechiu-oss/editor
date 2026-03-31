import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import geoip from 'geoip-lite';

export const ipBlockMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';

  // Skip localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip?.startsWith('::ffff:127')) { next(); return; }

  try {
    // Check old-style firewall blacklist
    const firewallBlocked = await prisma.firewallRule.findFirst({
      where: { type: 'BLACKLIST', value: ip, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    if (firewallBlocked) { res.status(403).json({ error: 'Access denied' }); return; }

    // Check IpBlock table
    const ipBlocked = await prisma.ipBlock.findFirst({ where: { value: ip, isActive: true } });
    if (ipBlocked) { res.status(403).json({ error: 'Access denied' }); return; }

    // Geo-based blocking
    const geo = geoip.lookup(ip);
    if (geo) {
      // Country block
      if (geo.country) {
        const countryBlocked = await prisma.countryBlock.findFirst({ where: { countryCode: geo.country, isActive: true } });
        if (countryBlocked) { res.status(403).json({ error: 'Access denied from your region' }); return; }
      }
      // ASN/ISP block
      const org = (geo as any).org || '';
      if (org) {
        const asnBlocked = await prisma.asnBlock.findFirst({ where: { OR: [{ asn: { contains: org.split(' ')[0] } }, { asnName: { contains: org, mode: 'insensitive' } }], isActive: true } });
        if (asnBlocked) { res.status(403).json({ error: 'Access denied' }); return; }

        const ispBlocked = await prisma.ispBlock.findFirst({ where: { ispName: { contains: org, mode: 'insensitive' }, isActive: true } });
        if (ispBlocked) { res.status(403).json({ error: 'Access denied' }); return; }
      }
    }
  } catch { /* don't block on DB error */ }
  next();
};
