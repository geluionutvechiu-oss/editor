const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, queryOne } = require('../config/database');
const { cache, redis } = require('../config/redis');
const { authenticate, requireRole } = require('../middleware/auth');
const { checkStreamHealth } = require('../services/streamHealth');
const logger = require('../config/logger');

// GET /api/admin/dashboard - real-time stats
router.get('/dashboard', authenticate, requireRole('admin', 'reseller'), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const resellerFilter = isAdmin ? '' : 'AND u.reseller_id = ' + req.user.id;

  const [
    userStats,
    streamStats,
    vodStats,
    seriesStats,
    serverStats,
    recentLogins,
    topStreams,
    bandwidth
  ] = await Promise.all([
    query(`
      SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN is_active = 1 AND is_banned = 0 AND (exp_date IS NULL OR exp_date > NOW()) THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN exp_date IS NOT NULL AND exp_date < NOW() THEN 1 ELSE 0 END) as expired_users,
        SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) as banned_users,
        SUM(CASE WHEN exp_date IS NOT NULL AND exp_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as expiring_soon,
        SUM(CASE WHEN trial_mode = 1 THEN 1 ELSE 0 END) as trial_users
      FROM users u WHERE role = 'user' ${resellerFilter}
    `),
    query(`
      SELECT
        COUNT(*) as total_streams,
        SUM(CASE WHEN stream_status = 'online' THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN stream_status = 'offline' THEN 1 ELSE 0 END) as offline,
        SUM(CASE WHEN stream_status = 'unknown' THEN 1 ELSE 0 END) as unknown,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as disabled
      FROM streams WHERE stream_type = 'live'
    `),
    query('SELECT COUNT(*) as total FROM vod_streams WHERE is_active = 1'),
    query('SELECT COUNT(*) as total FROM series WHERE is_active = 1'),
    isAdmin ? query('SELECT id, name, status, cpu_load, ram_usage, total_clients, max_clients, bandwidth_out FROM servers ORDER BY is_load_balancer DESC') : Promise.resolve([]),
    query(`
      SELECT u.username, u.last_login, u.last_login_ip, u.role
      FROM users u
      WHERE u.last_login IS NOT NULL ${resellerFilter}
      ORDER BY u.last_login DESC LIMIT 10
    `),
    query(`
      SELECT s.id, s.name, s.stream_icon, COUNT(cl.id) as connection_count
      FROM streams s
      LEFT JOIN connection_logs cl ON cl.stream_id = s.id AND cl.connected_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      WHERE s.stream_type = 'live'
      GROUP BY s.id ORDER BY connection_count DESC LIMIT 10
    `),
    query(`
      SELECT
        SUM(bytes_received) as total_bytes,
        COUNT(*) as total_connections,
        AVG(duration_secs) as avg_duration
      FROM connection_logs
      WHERE connected_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `)
  ]);

  // Get active connections from Redis
  let totalActiveConns = 0;
  try {
    const connKeys = await redis.keys('connections:user:*');
    for (const key of connKeys) {
      totalActiveConns += await redis.hlen(key);
    }
  } catch { /* Redis temporarily unavailable */ }

  res.json({
    success: true,
    data: {
      users: userStats[0],
      streams: streamStats[0],
      vod: { total: vodStats[0]?.total || 0 },
      series: { total: seriesStats[0]?.total || 0 },
      servers: serverStats,
      active_connections: totalActiveConns,
      recent_logins: recentLogins,
      top_streams: topStreams,
      bandwidth_24h: bandwidth[0]
    }
  });
});

// GET /api/admin/servers - server management
router.get('/servers', authenticate, requireRole('admin'), async (req, res) => {
  const servers = await query('SELECT * FROM servers ORDER BY is_load_balancer DESC, name ASC');
  res.json({ success: true, data: servers });
});

// POST /api/admin/servers
router.post('/servers', authenticate, requireRole('admin'), [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('domain').trim().notEmpty().isLength({ max: 255 }),
  body('ip_address').isIP(),
  body('http_port').isInt({ min: 1, max: 65535 }),
  body('max_clients').isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, domain, ip_address, http_port, https_port, rtmp_port, max_clients, is_load_balancer, weight, notes } = req.body;

  const [result] = await query(
    `INSERT INTO servers (name, domain, ip_address, http_port, https_port, rtmp_port,
      max_clients, is_load_balancer, weight, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, domain, ip_address, http_port, https_port || 8443, rtmp_port || 1935,
     max_clients, is_load_balancer ? 1 : 0, weight || 1, notes || null]
  );

  await cache.del('server_info');
  res.status(201).json({ success: true, message: 'Server added', id: result.insertId });
});

// PUT /api/admin/servers/:id
router.put('/servers/:id', authenticate, requireRole('admin'), async (req, res) => {
  const serverId = parseInt(req.params.id);
  const allowed = ['name', 'domain', 'ip_address', 'http_port', 'https_port', 'rtmp_port',
                   'status', 'max_clients', 'is_load_balancer', 'weight', 'notes', 'server_protocol'];
  const updates = {};
  for (const f of allowed) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ success: false, message: 'Nothing to update' });
  }

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await query(`UPDATE servers SET ${sets} WHERE id = ?`, [...Object.values(updates), serverId]);
  await cache.del('server_info');
  res.json({ success: true, message: 'Server updated' });
});

// DELETE /api/admin/servers/:id
router.delete('/servers/:id', authenticate, requireRole('admin'), async (req, res) => {
  await query('DELETE FROM servers WHERE id = ?', [parseInt(req.params.id)]);
  await cache.del('server_info');
  res.json({ success: true, message: 'Server deleted' });
});

// GET /api/admin/settings
router.get('/settings', authenticate, requireRole('admin'), async (req, res) => {
  const settings = await query('SELECT `key`, `value`, `description`, `type` FROM settings ORDER BY `key` ASC');
  res.json({ success: true, data: settings });
});

// PUT /api/admin/settings
router.put('/settings', authenticate, requireRole('admin'), async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid settings object' });
  }

  for (const [key, value] of Object.entries(updates)) {
    await query(
      'UPDATE settings SET `value` = ? WHERE `key` = ?',
      [String(value), key]
    );
  }

  await cache.del('server_info');
  res.json({ success: true, message: 'Settings updated' });
});

// GET /api/admin/connection-logs
router.get('/connection-logs', authenticate, requireRole('admin', 'reseller'), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;
  const userId = req.query.user_id;
  const streamId = req.query.stream_id;
  const ip = req.query.ip;

  let where = ['1=1'];
  let params = [];

  if (req.user.role === 'reseller') {
    where.push('EXISTS (SELECT 1 FROM users u WHERE u.id = cl.user_id AND u.reseller_id = ?)');
    params.push(req.user.id);
  }

  if (userId) { where.push('cl.user_id = ?'); params.push(parseInt(userId)); }
  if (streamId) { where.push('cl.stream_id = ?'); params.push(parseInt(streamId)); }
  if (ip) { where.push('cl.ip_address LIKE ?'); params.push(`%${ip}%`); }

  const whereStr = where.join(' AND ');
  const [[{ total }]] = await Promise.all([
    query(`SELECT COUNT(*) as total FROM connection_logs cl WHERE ${whereStr}`, params)
  ]);

  const logs = await query(
    `SELECT cl.id, cl.user_id, cl.stream_id, cl.stream_type, cl.ip_address,
            cl.user_agent, cl.country, cl.city, cl.connected_at, cl.disconnected_at,
            cl.bytes_received, cl.duration_secs,
            u.username, s.name as stream_name
     FROM connection_logs cl
     JOIN users u ON u.id = cl.user_id
     LEFT JOIN streams s ON s.id = cl.stream_id
     WHERE ${whereStr}
     ORDER BY cl.connected_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/admin/active-connections
router.get('/active-connections', authenticate, requireRole('admin', 'reseller'), async (req, res) => {
  const { redis } = require('../config/redis');
  const keys = await redis.keys('connections:user:*');

  const connections = [];
  for (const key of keys) {
    const userId = parseInt(key.split(':')[2]);
    const data = await redis.hgetall(key);
    if (!data) continue;

    for (const [token, val] of Object.entries(data)) {
      try {
        const conn = JSON.parse(val);
        connections.push({ userId, token, ...conn });
      } catch {}
    }
  }

  // Fetch usernames
  if (connections.length > 0) {
    const userIds = [...new Set(connections.map(c => c.userId))];
    const users = await query(
      `SELECT id, username, reseller_id FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
      userIds
    );
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    connections.forEach(c => {
      c.username = userMap[c.userId]?.username || 'Unknown';
    });

    if (req.user.role === 'reseller') {
      return res.json({
        success: true,
        data: connections.filter(c => {
          const u = userMap[c.userId];
          return u && u.reseller_id === req.user.id;
        })
      });
    }
  }

  res.json({ success: true, data: connections, total: connections.length });
});

// GET /api/admin/revenue - revenue reports
router.get('/revenue', authenticate, requireRole('admin'), async (req, res) => {
  const period = req.query.period || 'month'; // day, week, month, year

  let groupFormat, interval;
  switch (period) {
    case 'day': groupFormat = '%Y-%m-%d %H:00'; interval = '7 DAY'; break;
    case 'week': groupFormat = '%Y-%u'; interval = '12 WEEK'; break;
    case 'year': groupFormat = '%Y'; interval = '5 YEAR'; break;
    default: groupFormat = '%Y-%m'; interval = '12 MONTH';
  }

  const revenue = await query(`
    SELECT
      DATE_FORMAT(created_at, '${groupFormat}') as period,
      COUNT(*) as transactions,
      SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as credits_added,
      SUM(CASE WHEN type = 'debit' THEN ABS(amount) ELSE 0 END) as credits_used
    FROM credit_transactions
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
    GROUP BY period
    ORDER BY period ASC
  `);

  const subscriptions = await query(`
    SELECT
      DATE_FORMAT(created_at, '${groupFormat}') as period,
      COUNT(*) as count,
      SUM(price) as total_revenue
    FROM subscriptions
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
    GROUP BY period
    ORDER BY period ASC
  `);

  res.json({ success: true, data: { revenue, subscriptions } });
});

// POST /api/admin/stream-health-check - bulk health check
router.post('/stream-health-check', authenticate, requireRole('admin'), async (req, res) => {
  const categoryId = req.body.category_id;
  let streams;

  if (categoryId) {
    streams = await query(
      'SELECT id, name, direct_source FROM streams WHERE category_id = ? AND is_active = 1 AND stream_type = "live"',
      [parseInt(categoryId)]
    );
  } else {
    streams = await query(
      'SELECT id, name, direct_source FROM streams WHERE is_active = 1 AND stream_type = "live" LIMIT 100'
    );
  }

  res.json({ success: true, message: `Health check started for ${streams.length} streams` });

  // Run async in background
  (async () => {
    const batchSize = 10;
    for (let i = 0; i < streams.length; i += batchSize) {
      const batch = streams.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(async (stream) => {
        const result = await checkStreamHealth(stream.direct_source);
        await query(
          'UPDATE streams SET stream_status = ?, last_status_check = NOW() WHERE id = ?',
          [result.online ? 'online' : 'offline', stream.id]
        );
      }));
      // Small delay between batches
      await new Promise(r => setTimeout(r, 500));
    }
    await cache.delPattern('streams:list:*');
    logger.info('Bulk health check complete', { count: streams.length });
  })();
});

// GET /api/admin/ip-filter
router.get('/ip-filter', authenticate, requireRole('admin'), async (req, res) => {
  const filters = await query('SELECT * FROM ip_filter ORDER BY created_at DESC');
  res.json({ success: true, data: filters });
});

// POST /api/admin/ip-filter
router.post('/ip-filter', authenticate, requireRole('admin'), [
  body('ip_address').notEmpty(),
  body('type').isIn(['blacklist', 'whitelist']),
  body('reason').optional().isLength({ max: 500 }),
  body('expires_at').optional({ nullable: true }).isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { ip_address, cidr, type, reason, expires_at } = req.body;
  const [result] = await query(
    'INSERT INTO ip_filter (ip_address, cidr, type, reason, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [ip_address, cidr || null, type, reason || null, expires_at || null, req.user.id]
  );

  await cache.del('ip_filters');
  res.status(201).json({ success: true, message: 'IP filter added', id: result.insertId });
});

// DELETE /api/admin/ip-filter/:id
router.delete('/ip-filter/:id', authenticate, requireRole('admin'), async (req, res) => {
  await query('DELETE FROM ip_filter WHERE id = ?', [parseInt(req.params.id)]);
  await cache.del('ip_filters');
  res.json({ success: true, message: 'IP filter removed' });
});

// GET /api/admin/bouquets
router.get('/bouquets', authenticate, requireRole('admin'), async (req, res) => {
  const bouquets = await query(`
    SELECT b.*,
      (SELECT COUNT(*) FROM bouquet_streams bs WHERE bs.bouquet_id = b.id AND bs.stream_type = 'live') as live_count,
      (SELECT COUNT(*) FROM bouquet_streams bs WHERE bs.bouquet_id = b.id AND bs.stream_type = 'vod') as vod_count,
      (SELECT COUNT(*) FROM bouquet_streams bs WHERE bs.bouquet_id = b.id AND bs.stream_type = 'series') as series_count,
      (SELECT COUNT(*) FROM users WHERE bouquet_id = b.id) as user_count
    FROM bouquets b ORDER BY sort_order ASC, name ASC
  `);
  res.json({ success: true, data: bouquets });
});

// POST /api/admin/bouquets
router.post('/bouquets', authenticate, requireRole('admin'), [
  body('name').trim().notEmpty().isLength({ max: 150 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, description, welcome_message } = req.body;
  const [result] = await query(
    'INSERT INTO bouquets (name, description, welcome_message) VALUES (?, ?, ?)',
    [name, description || null, welcome_message || null]
  );

  res.status(201).json({ success: true, message: 'Bouquet created', id: result.insertId });
});

// PUT /api/admin/bouquets/:id/streams - set streams in bouquet
router.put('/bouquets/:id/streams', authenticate, requireRole('admin'), async (req, res) => {
  const bouquetId = parseInt(req.params.id);
  const { stream_type, stream_ids } = req.body;

  if (!['live', 'vod', 'series'].includes(stream_type)) {
    return res.status(400).json({ success: false, message: 'Invalid stream_type' });
  }

  if (!Array.isArray(stream_ids)) {
    return res.status(400).json({ success: false, message: 'stream_ids must be array' });
  }

  // Replace all streams of this type in bouquet
  await query('DELETE FROM bouquet_streams WHERE bouquet_id = ? AND stream_type = ?', [bouquetId, stream_type]);

  if (stream_ids.length > 0) {
    const values = stream_ids.map((id, idx) => `(?, ?, ?, ${idx})`).join(', ');
    const params = stream_ids.flatMap(id => [bouquetId, id, stream_type]);
    await query(`INSERT IGNORE INTO bouquet_streams (bouquet_id, stream_id, stream_type, sort_order) VALUES ${values}`, params);
  }

  res.json({ success: true, message: `Bouquet streams updated: ${stream_ids.length} ${stream_type} streams` });
});

// ============================================================
// RESELLERS
// ============================================================

// GET /api/admin/resellers
router.get('/resellers', authenticate, requireRole('admin'), async (req, res) => {
  const resellers = await query(`
    SELECT r.*, u.username, u.email, u.is_active,
      (SELECT COUNT(*) FROM users WHERE reseller_id = r.user_id) as user_count
    FROM resellers r
    JOIN users u ON u.id = r.user_id
    ORDER BY u.username ASC
  `);
  res.json({ success: true, data: { resellers } });
});

// POST /api/admin/resellers
router.post('/resellers', authenticate, requireRole('admin'), [
  body('username').trim().notEmpty().isLength({ min: 3, max: 50 }),
  body('password').isLength({ min: 8 }),
  body('credits').isInt({ min: 0 }),
  body('max_users').isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { username, email, password, credits, max_users, expires_at } = req.body;
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash(password, 12);
  const { transaction } = require('../config/database');

  await transaction(async (conn) => {
    const [userRes] = await conn.execute(
      'INSERT INTO users (username, password, email, role, is_active, max_connections) VALUES (?, ?, ?, "reseller", 1, 1)',
      [username, hash, email || null]
    );
    const userId = userRes.insertId;
    await conn.execute(
      'INSERT INTO resellers (user_id, credits, max_users, expires_at) VALUES (?, ?, ?, ?)',
      [userId, credits, max_users, expires_at || null]
    );
    if (credits > 0) {
      await conn.execute(
        'INSERT INTO credit_transactions (reseller_id, type, amount, description) VALUES (?, "credit", ?, "Initial credits by admin")',
        [userId, credits]
      );
    }
  });

  res.status(201).json({ success: true, message: 'Reseller created' });
});

// PUT /api/admin/resellers/:id
router.put('/resellers/:id', authenticate, requireRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const bcrypt = require('bcrypt');

  const reseller = await queryOne('SELECT user_id FROM resellers WHERE user_id = ?', [id]);
  if (!reseller) return res.status(404).json({ success: false, message: 'Reseller not found' });

  const { username, email, password, credits, max_users, expires_at, is_active } = req.body;
  const userUpdates = {};
  const resellerUpdates = {};

  if (username !== undefined) userUpdates.username = username;
  if (email !== undefined) userUpdates.email = email;
  if (is_active !== undefined) userUpdates.is_active = is_active ? 1 : 0;
  if (password) userUpdates.password = await bcrypt.hash(password, 12);

  if (credits !== undefined) resellerUpdates.credits = credits;
  if (max_users !== undefined) resellerUpdates.max_users = max_users;
  if (expires_at !== undefined) resellerUpdates.expires_at = expires_at || null;

  if (Object.keys(userUpdates).length) {
    const sets = Object.keys(userUpdates).map(k => `${k} = ?`).join(', ');
    await query(`UPDATE users SET ${sets} WHERE id = ?`, [...Object.values(userUpdates), id]);
  }
  if (Object.keys(resellerUpdates).length) {
    const sets = Object.keys(resellerUpdates).map(k => `${k} = ?`).join(', ');
    await query(`UPDATE resellers SET ${sets} WHERE user_id = ?`, [...Object.values(resellerUpdates), id]);
  }

  res.json({ success: true, message: 'Reseller updated' });
});

// POST /api/admin/resellers/:id/credits
router.post('/resellers/:id/credits', authenticate, requireRole('admin'), [
  body('amount').isInt({ min: 1 })
], async (req, res) => {
  const id = parseInt(req.params.id);
  const { amount } = req.body;

  await query('UPDATE resellers SET credits = credits + ? WHERE user_id = ?', [amount, id]);
  await query(
    'INSERT INTO credit_transactions (reseller_id, type, amount, description, created_by) VALUES (?, "credit", ?, "Admin credit top-up", ?)',
    [id, amount, req.user.id]
  );

  res.json({ success: true, message: `Added ${amount} credits` });
});

// ============================================================
// PLANS
// ============================================================

// GET /api/admin/plans
router.get('/plans', authenticate, requireRole('admin', 'reseller'), async (req, res) => {
  const plans = await query('SELECT * FROM plans ORDER BY price ASC');
  const parsed = plans.map(p => ({
    ...p,
    features: (() => { try { return JSON.parse(p.features || '[]'); } catch { return []; } })()
  }));
  res.json({ success: true, data: { plans: parsed } });
});

// POST /api/admin/plans
router.post('/plans', authenticate, requireRole('admin'), [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('duration_days').isInt({ min: 1 }),
  body('max_connections').isInt({ min: 1 }),
  body('price').isFloat({ min: 0 }),
  body('credits_cost').isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, duration_days, max_connections, price, credits_cost, description, features, is_active } = req.body;
  const [result] = await query(
    'INSERT INTO plans (name, duration_days, max_connections, price, credits_cost, description, features, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, duration_days, max_connections, price, credits_cost, description || null,
     JSON.stringify(features || []), is_active !== false ? 1 : 0]
  );

  res.status(201).json({ success: true, message: 'Plan created', id: result.insertId });
});

// PUT /api/admin/plans/:id
router.put('/plans/:id', authenticate, requireRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const allowed = ['name', 'duration_days', 'max_connections', 'price', 'credits_cost', 'description', 'is_active'];
  const updates = {};
  for (const f of allowed) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (req.body.features !== undefined) updates.features = JSON.stringify(req.body.features);

  if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'Nothing to update' });

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await query(`UPDATE plans SET ${sets} WHERE id = ?`, [...Object.values(updates), id]);
  res.json({ success: true, message: 'Plan updated' });
});

// DELETE /api/admin/plans/:id
router.delete('/plans/:id', authenticate, requireRole('admin'), async (req, res) => {
  await query('DELETE FROM plans WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ success: true, message: 'Plan deleted' });
});

// GET /api/admin/reports/top-streams
router.get('/reports/top-streams', authenticate, requireRole('admin'), async (req, res) => {
  const days = Math.min(90, parseInt(req.query.days) || 7);
  const streams = await query(`
    SELECT s.id, s.name, s.stream_icon, s.stream_type, sc.name as category_name,
      COUNT(cl.id) as connections,
      SUM(cl.duration_secs) as total_seconds,
      COUNT(DISTINCT cl.user_id) as unique_viewers
    FROM streams s
    LEFT JOIN connection_logs cl ON cl.stream_id = s.id
      AND cl.connected_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    LEFT JOIN stream_categories sc ON sc.id = s.category_id
    GROUP BY s.id
    ORDER BY connections DESC
    LIMIT 50
  `, [days]);
  res.json({ success: true, data: streams });
});

// GET /api/admin/reports/connections
router.get('/reports/connections', authenticate, requireRole('admin'), async (req, res) => {
  const days = Math.min(90, parseInt(req.query.days) || 7);
  const stats = await query(`
    SELECT
      DATE_FORMAT(connected_at, '%Y-%m-%d %H:00') as hour,
      COUNT(*) as connections,
      COUNT(DISTINCT user_id) as unique_users,
      AVG(duration_secs) as avg_duration,
      SUM(bytes_received) as bytes
    FROM connection_logs
    WHERE connected_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY hour
    ORDER BY hour ASC
  `, [days]);
  res.json({ success: true, data: stats });
});

module.exports = router;
