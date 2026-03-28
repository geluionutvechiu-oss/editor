const WebSocket = require('ws');
const { verifyToken } = require('../middleware/auth');
const { cache, redis } = require('../config/redis');
const { query } = require('../config/database');
const logger = require('../config/logger');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({
    server,
    path: '/ws',
    clientTracking: true,
    perMessageDeflate: false
  });

  // Map of userId -> Set of ws clients
  const userSockets = new Map();
  const adminSockets = new Set();

  wss.on('connection', async (ws, req) => {
    ws.isAlive = true;
    ws.userId = null;
    ws.role = null;
    ws.authenticated = false;

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    logger.debug('WS connection', { ip });

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (rawData) => {
      let data;
      try {
        data = JSON.parse(rawData.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      switch (data.type) {
        case 'auth': {
          if (!data.token) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Token required' }));
            return;
          }
          try {
            const decoded = verifyToken(data.token);
            ws.userId = decoded.id;
            ws.role = decoded.role;
            ws.authenticated = true;

            if (!userSockets.has(decoded.id)) userSockets.set(decoded.id, new Set());
            userSockets.get(decoded.id).add(ws);

            if (decoded.role === 'admin') adminSockets.add(ws);

            ws.send(JSON.stringify({ type: 'auth_ok', userId: decoded.id, role: decoded.role }));

            // Send initial stats to admin
            if (decoded.role === 'admin') {
              const stats = await getStats();
              ws.send(JSON.stringify({ type: 'stats', data: stats }));
            }
          } catch {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
          }
          break;
        }

        case 'subscribe_stats': {
          if (!ws.authenticated || ws.role !== 'admin') {
            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
            return;
          }
          ws.subscribed_stats = true;
          break;
        }

        case 'heartbeat': {
          if (!ws.authenticated) break;
          // Update heartbeat in Redis
          const connections = await cache.getUserConnections(ws.userId);
          for (const conn of connections) {
            await cache.hset(
              `connections:user:${ws.userId}`,
              conn.token,
              { ...conn, lastHeartbeat: Date.now() }
            );
          }
          ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          break;
        }
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        const sockets = userSockets.get(ws.userId);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) userSockets.delete(ws.userId);
        }
        adminSockets.delete(ws);
      }
    });

    ws.on('error', (err) => {
      logger.debug('WS error', { userId: ws.userId, err: err.message });
    });
  });

  // Heartbeat check
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  // Broadcast stats to admin clients every 5 seconds
  const statsInterval = setInterval(async () => {
    if (adminSockets.size === 0) return;

    try {
      const stats = await getStats();
      const payload = JSON.stringify({ type: 'stats', data: stats });

      for (const ws of adminSockets) {
        if (ws.readyState === WebSocket.OPEN && ws.subscribed_stats) {
          ws.send(payload);
        }
      }
    } catch (err) {
      logger.error('WS stats broadcast error', { err: err.message });
    }
  }, 5000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(statsInterval);
  });

  // Broadcast to specific user
  function broadcastToUser(userId, data) {
    const sockets = userSockets.get(userId);
    if (!sockets) return;
    const payload = JSON.stringify(data);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

  // Broadcast to all admins
  function broadcastToAdmins(data) {
    const payload = JSON.stringify(data);
    for (const ws of adminSockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

  logger.info('WebSocket server initialized');
  return { wss, broadcastToUser, broadcastToAdmins };
}

async function getStats() {
  const [userStats, streamStats] = await Promise.all([
    query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_active=1 AND is_banned=0 AND (exp_date IS NULL OR exp_date > NOW()) THEN 1 ELSE 0 END) as active
      FROM users WHERE role = 'user'
    `),
    query(`
      SELECT
        SUM(CASE WHEN stream_status='online' THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN stream_status='offline' THEN 1 ELSE 0 END) as offline,
        COUNT(*) as total
      FROM streams WHERE stream_type='live' AND is_active=1
    `)
  ]);

  // Count active connections from Redis
  let totalConnections = 0;
  const connKeys = await redis.keys('connections:user:*');
  for (const key of connKeys) {
    totalConnections += await redis.hlen(key);
  }

  return {
    timestamp: Date.now(),
    users: userStats[0],
    streams: streamStats[0],
    active_connections: totalConnections
  };
}

module.exports = { setupWebSocket };
