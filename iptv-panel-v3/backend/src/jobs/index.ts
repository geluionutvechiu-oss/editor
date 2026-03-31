import Queue from 'bull';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { sendExpiryWarning } from '../services/emailService';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const expiryQueue = new Queue('client-expiry', { redis: redisConfig });
export const statsQueue = new Queue('server-stats', { redis: redisConfig });
export const cleanupQueue = new Queue('cleanup', { redis: redisConfig });

// Job: Check for expired clients and send warnings
expiryQueue.process(async () => {
  logger.info('Running expiry check job');
  const now = new Date();

  // Expire clients past their expiry date
  const expired = await prisma.client.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: now } },
    data: { status: 'EXPIRED' },
  });
  if (expired.count > 0) logger.info(`Expired ${expired.count} clients`);

  // 3-day warning
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const expiring3d = await prisma.client.findMany({
    where: { status: 'ACTIVE', expiresAt: { gte: now, lte: threeDaysFromNow } },
    include: { owner: { select: { email: true } } },
  });
  for (const client of expiring3d) {
    const daysLeft = Math.ceil((client.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    await sendExpiryWarning({ username: client.username }, client.owner.email, daysLeft).catch(() => {});
    await prisma.notification.create({
      data: { userId: client.ownerId, title: 'Client Expiring Soon', message: `${client.username} expires in ${daysLeft} day(s)`, type: 'WARNING', link: '/clients' },
    }).catch(() => {});
  }
  if (expiring3d.length > 0) logger.info(`Sent ${expiring3d.length} expiry warning notifications`);
});

// Job: Update server stats
statsQueue.process(async () => {
  const servers = await prisma.server.findMany();
  for (const server of servers) {
    // In production: query actual server API for real stats
    // Here we simulate minor fluctuations for demo purposes
    const fluctuation = Math.floor(Math.random() * 5) - 2;
    await prisma.server.update({
      where: { id: server.id },
      data: {
        activeStreams: Math.max(0, server.activeStreams + fluctuation),
        lastChecked: new Date(),
      },
    }).catch(() => {});
  }
});

// Job: Clean up old audit logs (keep 90 days)
cleanupQueue.process(async () => {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const deleted = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  logger.info(`Cleaned up ${deleted.count} old audit log entries`);

  // Clean up expired sessions
  const sessionsCleaned = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  logger.info(`Cleaned up ${sessionsCleaned.count} expired sessions`);
});

// Schedule recurring jobs
export function startJobs() {
  // Every hour: check expiry
  expiryQueue.add({}, { repeat: { cron: '0 * * * *' } });
  // Every 30 seconds: update stats
  statsQueue.add({}, { repeat: { cron: '*/30 * * * * *' } });
  // Daily at 3am: cleanup
  cleanupQueue.add({}, { repeat: { cron: '0 3 * * *' } });

  logger.info('Background jobs started');
}
