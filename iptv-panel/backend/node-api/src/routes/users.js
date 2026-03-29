const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, query: qParam, validationResult } = require('express-validator');
const { query, queryOne, transaction } = require('../config/database');
const { cache } = require('../config/redis');
const { authenticate, requireRole } = require('../middleware/auth');
const logger = require('../config/logger');

// GET /api/users - admin/reseller
router.get('/', authenticate, requireRole('admin', 'reseller'), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 25);
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const role = req.query.role || '';
  const status = req.query.status || '';

  let where = ['1=1'];
  let params = [];

  // Resellers only see their own clients
  if (req.user.role === 'reseller') {
    where.push('u.reseller_id = ?');
    params.push(req.user.id);
  }

  if (search) {
    where.push('(u.username LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (role && ['admin', 'reseller', 'user'].includes(role)) {
    where.push('u.role = ?');
    params.push(role);
  }

  if (status === 'active') {
    where.push('u.is_active = 1 AND u.is_banned = 0 AND (u.exp_date IS NULL OR u.exp_date > NOW())');
  } else if (status === 'expired') {
    where.push('u.exp_date IS NOT NULL AND u.exp_date < NOW()');
  } else if (status === 'banned') {
    where.push('u.is_banned = 1');
  }

  const whereStr = where.join(' AND ');

  const [[{ total }]] = await Promise.all([
    query(`SELECT COUNT(*) as total FROM users u WHERE ${whereStr}`, params)
  ]);

  const users = await query(
    `SELECT u.id, u.username, u.email, u.role, u.is_active, u.is_banned,
            u.exp_date, u.max_connections, u.max_mobile_connections, u.max_stb_connections,
            u.member_since, u.last_login,
            u.last_login_ip, u.trial_mode, u.bouquet_id, u.reseller_id,
            b.name as bouquet_name
     FROM users u
     LEFT JOIN bouquets b ON b.id = u.bouquet_id
     WHERE ${whereStr}
     ORDER BY u.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Add active connection count from Redis
  const usersWithConns = await Promise.all(users.map(async (u) => {
    const activeConns = await cache.getUserConnectionCount(u.id);
    return { ...u, active_connections: activeConns };
  }));

  res.json({
    success: true,
    data: usersWithConns,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/users/:id
router.get('/:id', authenticate, requireRole('admin', 'reseller'), async (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID' });

  const user = await queryOne(
    `SELECT u.id, u.username, u.email, u.role, u.is_active, u.is_banned,
            u.ban_reason, u.exp_date, u.max_connections, u.max_mobile_connections, u.max_stb_connections,
            u.allowed_output_formats,
            u.ip_whitelist, u.member_since, u.last_login, u.last_login_ip,
            u.last_user_agent, u.trial_mode, u.bouquet_id, u.reseller_id, u.notes,
            u.timezone, u.created_at,
            b.name as bouquet_name,
            r.credits as reseller_credits
     FROM users u
     LEFT JOIN bouquets b ON b.id = u.bouquet_id
     LEFT JOIN resellers r ON r.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );

  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  // Resellers can only view their clients
  if (req.user.role === 'reseller' && user.reseller_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const [connections, recentLogs] = await Promise.all([
    cache.getUserConnections(userId),
    query(
      `SELECT ip_address, user_agent, stream_id, stream_type, connected_at, disconnected_at
       FROM connection_logs WHERE user_id = ? ORDER BY connected_at DESC LIMIT 20`,
      [userId]
    )
  ]);

  res.json({
    success: true,
    data: {
      ...user,
      active_connections: connections,
      recent_logs: recentLogs
    }
  });
});

// POST /api/users - create user
router.post('/', authenticate, requireRole('admin', 'reseller'), [
  body('username').trim().isLength({ min: 3, max: 64 }).matches(/^[a-zA-Z0-9_.-]+$/),
  body('password').isLength({ min: 6, max: 128 }),
  body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
  body('max_connections').isInt({ min: 1, max: 100 }).default(1),
  body('max_mobile_connections').optional().isInt({ min: 1, max: 100 }).default(1),
  body('max_stb_connections').optional().isInt({ min: 1, max: 100 }).default(1),
  body('exp_date').optional({ nullable: true }).isISO8601(),
  body('bouquet_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('notes').optional().isLength({ max: 1000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, password, email, max_connections, max_mobile_connections, max_stb_connections, exp_date, bouquet_id, notes } = req.body;

  const existing = await queryOne('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return res.status(409).json({ success: false, message: 'Username already taken' });
  }

  // Resellers deduct credits
  if (req.user.role === 'reseller') {
    const reseller = await queryOne('SELECT credits FROM resellers WHERE user_id = ?', [req.user.id]);
    if (!reseller || reseller.credits < 1) {
      return res.status(402).json({ success: false, message: 'Insufficient credits' });
    }
  }

  const hashed = await bcrypt.hash(password, 12);
  const role = req.user.role === 'reseller' ? 'user' : (req.body.role || 'user');

  const result = await transaction(async (conn) => {
    const [insertResult] = await conn.execute(
      `INSERT INTO users (username, password, email, role, max_connections,
        max_mobile_connections, max_stb_connections,
        exp_date, bouquet_id, reseller_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username, hashed, email || null, role,
        max_connections || 1,
        max_mobile_connections || 1,
        max_stb_connections || 1,
        exp_date || null,
        bouquet_id || null,
        req.user.role === 'reseller' ? req.user.id : null,
        notes || null, req.user.id
      ]
    );

    const newUserId = insertResult.insertId;

    // Deduct reseller credit
    if (req.user.role === 'reseller') {
      await conn.execute(
        'UPDATE resellers SET credits = credits - 1, current_clients = current_clients + 1 WHERE user_id = ?',
        [req.user.id]
      );
      const [[{ credits }]] = await conn.execute('SELECT credits FROM resellers WHERE user_id = ?', [req.user.id]);
      await conn.execute(
        'INSERT INTO credit_transactions (reseller_id, amount, type, description, balance_after, created_by) VALUES ((SELECT id FROM resellers WHERE user_id = ?), -1, ?, ?, ?, ?)',
        [req.user.id, 'debit', `Created user: ${username}`, credits, req.user.id]
      );
    }

    return newUserId;
  });

  logger.info('User created', { createdBy: req.user.id, newUserId: result, username });
  res.status(201).json({ success: true, message: 'User created', id: result });
});

// PUT /api/users/:id
router.put('/:id', authenticate, requireRole('admin', 'reseller'), [
  body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
  body('max_connections').optional().isInt({ min: 1, max: 100 }),
  body('exp_date').optional({ nullable: true }).isISO8601(),
  body('is_active').optional().isBoolean(),
  body('is_banned').optional().isBoolean(),
  body('ban_reason').optional().isLength({ max: 500 }),
  body('bouquet_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('notes').optional().isLength({ max: 1000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const userId = parseInt(req.params.id);
  const user = await queryOne('SELECT id, reseller_id, role FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (req.user.role === 'reseller' && user.reseller_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const updates = {};
  const allowed = ['email', 'max_connections', 'max_mobile_connections', 'max_stb_connections',
                   'exp_date', 'is_active', 'is_banned',
                   'ban_reason', 'bouquet_id', 'notes', 'timezone'];

  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (req.body.password) {
    updates.password = await bcrypt.hash(req.body.password, 12);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No fields to update' });
  }

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await query(`UPDATE users SET ${sets} WHERE id = ?`, [...Object.values(updates), userId]);

  // Invalidate user cache
  await cache.del(`user:${userId}`);

  logger.info('User updated', { updatedBy: req.user.id, targetUserId: userId });
  res.json({ success: true, message: 'User updated' });
});

// DELETE /api/users/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const userId = parseInt(req.params.id);
  if (userId === req.user.id) {
    return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
  }

  const user = await queryOne('SELECT id, username FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  // Terminate active connections
  const connections = await cache.getUserConnections(userId);
  for (const conn of connections) {
    await cache.removeActiveConnection(userId, conn.token);
  }

  await query('DELETE FROM users WHERE id = ?', [userId]);
  logger.info('User deleted', { deletedBy: req.user.id, targetUserId: userId, username: user.username });
  res.json({ success: true, message: 'User deleted' });
});

// POST /api/users/:id/kick - terminate all active connections
router.post('/:id/kick', authenticate, requireRole('admin', 'reseller'), async (req, res) => {
  const userId = parseInt(req.params.id);
  const connections = await cache.getUserConnections(userId);

  for (const conn of connections) {
    await cache.removeActiveConnection(userId, conn.token);
  }

  res.json({ success: true, message: `Terminated ${connections.length} connection(s)` });
});

module.exports = router;
