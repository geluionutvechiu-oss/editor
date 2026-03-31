import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

export function setupSocket(io: SocketIOServer): void {
  // Auth middleware for socket
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) { next(new Error('Authentication required')); return; }
    try {
      const payload = verifyAccessToken(token);
      (socket as Socket & { user: typeof payload }).user = payload;
      next();
    } catch { next(new Error('Invalid token')); }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as Socket & { user: { userId: string; role: string } }).user;
    logger.info(`Socket connected: ${user.userId}`);

    // Join user room for targeted notifications
    socket.join(`user:${user.userId}`);
    if (user.role === 'ADMIN') socket.join('admins');

    // Send initial dashboard stats
    emitDashboardStats(io, user.userId, user.role);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${user.userId}`);
    });
  });

  // Emit server stats every 10 seconds
  setInterval(async () => {
    try {
      const servers = await prisma.server.findMany({
        select: { id: true, name: true, status: true, activeStreams: true, maxStreams: true, uptime: true, bandwidthMbps: true, lastChecked: true },
      });
      io.emit('server_stats', servers);
    } catch (err) { logger.error('Socket server stats error', { err }); }
  }, 10000);
}

async function emitDashboardStats(io: SocketIOServer, userId: string, role: string): Promise<void> {
  try {
    const isAdmin = role === 'ADMIN';
    const clientWhere = isAdmin ? {} : { ownerId: userId };

    const [total, active, expiringSoon] = await Promise.all([
      prisma.client.count({ where: clientWhere }),
      prisma.client.count({ where: { ...clientWhere, status: 'ACTIVE' } }),
      prisma.client.count({ where: { ...clientWhere, status: 'ACTIVE', expiresAt: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), gt: new Date() } } }),
    ]);

    io.to(`user:${userId}`).emit('dashboard_stats', { total, active, expiringSoon });
  } catch (err) { logger.error('Socket dashboard stats error', { err }); }
}

export async function emitNotification(io: SocketIOServer, userId: string, notification: object): Promise<void> {
  io.to(`user:${userId}`).emit('notification', notification);
}

export async function emitSharingAlert(io: SocketIOServer, alert: object): Promise<void> {
  io.to('admins').emit('sharing_alert', alert);
}
