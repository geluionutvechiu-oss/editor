const { cache } = require('../config/redis');
const { query } = require('../config/database');
const logger = require('../config/logger');

function ipToLong(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

function cidrContains(cidr, ip) {
  const [range, bits] = cidr.split('/');
  const mask = bits ? (~0 << (32 - parseInt(bits))) >>> 0 : 0xffffffff;
  return (ipToLong(range) & mask) === (ipToLong(ip) & mask);
}

async function loadIpFilters() {
  const cached = await cache.get('ip_filters');
  if (cached) return cached;

  const rows = await query(
    'SELECT ip_address, cidr, type FROM ip_filter WHERE (expires_at IS NULL OR expires_at > NOW())'
  );

  const filters = { blacklist: [], whitelist: [] };
  for (const row of rows) {
    filters[row.type].push({ ip: row.ip_address, cidr: row.cidr });
  }

  await cache.set('ip_filters', filters, 300); // 5 min cache
  return filters;
}

async function ipFilter(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress || '';
  const cleanIp = clientIp.replace('::ffff:', '');

  try {
    const filters = await loadIpFilters();

    // Check blacklist first
    for (const entry of filters.blacklist) {
      const match = entry.cidr
        ? cidrContains(entry.cidr, cleanIp)
        : entry.ip === cleanIp;
      if (match) {
        logger.warn('Blocked IP attempt', { ip: cleanIp });
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // If whitelist is non-empty, only allow listed IPs
    if (filters.whitelist.length > 0) {
      let allowed = false;
      for (const entry of filters.whitelist) {
        const match = entry.cidr
          ? cidrContains(entry.cidr, cleanIp)
          : entry.ip === cleanIp;
        if (match) { allowed = true; break; }
      }
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'IP not whitelisted' });
      }
    }
  } catch (err) {
    logger.error('IP filter error:', err);
    // Fail open to avoid blocking all traffic on Redis issues
  }

  next();
}

module.exports = { ipFilter, loadIpFilters };
