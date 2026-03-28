const jwt = require('jsonwebtoken');
const { cache } = require('../config/redis');
const { queryOne } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_in_production_use_256bit_secret';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
    algorithm: 'HS256'
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

async function authenticate(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  // Check if token was revoked
  const revoked = await cache.get(`revoked:${decoded.jti}`);
  if (revoked) {
    return res.status(401).json({ success: false, message: 'Token has been revoked' });
  }

  // Fetch fresh user data
  const user = await queryOne(
    'SELECT id, username, role, is_active, is_banned, exp_date, max_connections, bouquet_id, reseller_id FROM users WHERE id = ?',
    [decoded.id]
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found' });
  }

  if (!user.is_active || user.is_banned) {
    return res.status(403).json({ success: false, message: 'Account disabled or banned' });
  }

  if (user.exp_date && new Date(user.exp_date) < new Date()) {
    return res.status(403).json({ success: false, message: 'Subscription expired' });
  }

  req.user = user;
  req.token = token;
  req.tokenPayload = decoded;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

async function revokeToken(jti, expiresIn) {
  return cache.set(`revoked:${jti}`, 1, expiresIn);
}

module.exports = { authenticate, requireRole, generateToken, verifyToken, revokeToken };
