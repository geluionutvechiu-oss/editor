const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { query, queryOne } = require('../config/database');
const { cache } = require('../config/redis');
const { generateToken, authenticate, revokeToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const logger = require('../config/logger');
const geoip = require('geoip-lite');

// POST /api/auth/login
router.post('/login', authLimiter, [
  body('username').trim().notEmpty().isLength({ min: 3, max: 64 }),
  body('password').notEmpty().isLength({ min: 1, max: 128 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, password } = req.body;
  const clientIp = (req.ip || '').replace('::ffff:', '');

  // Check for brute force lockout
  const attemptKey = `login_attempts:${username}:${clientIp}`;
  const attempts = await cache.get(attemptKey) || 0;
  const maxAttempts = 10;

  if (attempts >= maxAttempts) {
    return res.status(429).json({
      success: false,
      message: 'Too many failed attempts. Account temporarily locked.'
    });
  }

  const user = await queryOne(
    `SELECT id, username, password, role, is_active, is_banned, ban_reason,
            exp_date, max_connections, bouquet_id, reseller_id, timezone
     FROM users WHERE username = ?`,
    [username]
  );

  if (!user || !await bcrypt.compare(password, user.password)) {
    await cache.incr(attemptKey, 900); // 15 min window
    logger.warn('Failed login', { username, ip: clientIp });
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }

  if (!user.is_active) {
    return res.status(403).json({ success: false, message: 'Account is disabled' });
  }

  if (user.is_banned) {
    return res.status(403).json({ success: false, message: `Account banned: ${user.ban_reason || 'Contact support'}` });
  }

  if (user.exp_date && new Date(user.exp_date) < new Date()) {
    return res.status(403).json({ success: false, message: 'Subscription expired' });
  }

  // Clear failed attempts
  await cache.del(attemptKey);

  const jti = uuidv4();
  const token = generateToken({
    id: user.id,
    username: user.username,
    role: user.role,
    jti
  });

  // Update last login
  const geo = geoip.lookup(clientIp);
  await query(
    'UPDATE users SET last_login = NOW(), last_login_ip = ?, last_user_agent = ? WHERE id = ?',
    [clientIp, req.headers['user-agent']?.substring(0, 499) || '', user.id]
  );

  logger.info('User login', { userId: user.id, username: user.username, ip: clientIp });

  const { password: _, ...userSafe } = user;
  res.json({
    success: true,
    token,
    user: {
      ...userSafe,
      geo: geo ? { country: geo.country, city: geo.city } : null
    }
  });
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { jti, exp } = req.tokenPayload;
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await revokeToken(jti, ttl);
    }
    logger.info('User logout', { userId: req.user.id });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.json({ success: true, message: 'Logged out' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await queryOne(
    `SELECT u.id, u.username, u.email, u.role, u.is_active, u.exp_date,
            u.max_connections, u.bouquet_id, u.timezone, u.member_since,
            u.last_login, u.last_login_ip,
            r.credits, r.max_clients, r.current_clients, r.dns
     FROM users u
     LEFT JOIN resellers r ON r.user_id = u.id
     WHERE u.id = ?`,
    [req.user.id]
  );

  const activeConns = await cache.getUserConnectionCount(req.user.id);

  res.json({
    success: true,
    user: {
      ...user,
      active_connections: activeConns
    }
  });
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 8 chars with uppercase, lowercase, and digit')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { current_password, new_password } = req.body;

  const user = await queryOne('SELECT id, password FROM users WHERE id = ?', [req.user.id]);
  if (!await bcrypt.compare(current_password, user.password)) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  const hashed = await bcrypt.hash(new_password, 12);
  await query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

  logger.info('Password changed', { userId: req.user.id });
  res.json({ success: true, message: 'Password updated successfully' });
});

module.exports = router;
