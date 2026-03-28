/**
 * Stream proxy cu suport linii separate: desktop / mobile / stb
 * Fiecare tip dispozitiv are limita sa proprie de conexiuni.
 *
 * Câmpuri relevante în users:
 *   max_connections        - desktop/generic
 *   max_mobile_connections - telefoane mobile
 *   max_stb_connections    - smart TV / STB
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { queryOne, query } = require('../config/database');
const { cache, redis } = require('../config/redis');
const logger = require('../config/logger');
const geoip = require('geoip-lite');
const { detectDeviceType } = require('../middleware/security');

const DEVICE_LIMIT_FIELD = {
  mobile:  'max_mobile_connections',
  tablet:  'max_mobile_connections',
  stb:     'max_stb_connections',
  desktop: 'max_connections',
  other:   'max_connections',
  unknown: 'max_connections',
};

async function streamProxy(req, res) {
  const { username, password, streamId: rawStreamId } = req.params;
  const pathType = req.path.startsWith('/live') ? 'live'
    : req.path.startsWith('/movie') ? 'vod'
    : req.path.startsWith('/series') ? 'series'
    : 'live';

  const streamId = parseInt(rawStreamId.replace(/\.\w+$/, ''));
  if (isNaN(streamId)) return res.status(400).send('Invalid stream ID');

  const clientIp = (req.ip || '').replace('::ffff:', '');
  const userAgent = req.headers['user-agent'] || '';
  const deviceType = detectDeviceType(userAgent);

  // ── Autentificare utilizator (cache 60s) ────────────────────────────────
  const userCacheKey = `auth:${username}:${password}`;
  let user = await cache.get(userCacheKey);

  if (!user) {
    user = await queryOne(
      `SELECT id, username, password, role, is_active, is_banned, exp_date,
              max_connections, max_mobile_connections, max_stb_connections,
              allowed_output_formats, bouquet_id, ip_whitelist
       FROM users WHERE username = ? AND role = 'user'`,
      [username]
    );

    if (!user) return res.status(401).send('Unauthorized');
    if (!await bcrypt.compare(password, user.password)) return res.status(401).send('Unauthorized');

    await cache.set(userCacheKey, user, 60);
  }

  if (!user.is_active || user.is_banned) return res.status(403).send('Account disabled');
  if (user.exp_date && new Date(user.exp_date) < new Date()) return res.status(403).send('Subscription expired');

  // ── IP whitelist ────────────────────────────────────────────────────────
  if (user.ip_whitelist) {
    const allowed = Array.isArray(user.ip_whitelist)
      ? user.ip_whitelist
      : JSON.parse(user.ip_whitelist || '[]');
    if (allowed.length > 0 && !allowed.includes(clientIp)) {
      return res.status(403).send('IP not allowed');
    }
  }

  // ── Limită conexiuni per tip dispozitiv ─────────────────────────────────
  const limitField = DEVICE_LIMIT_FIELD[deviceType] || 'max_connections';
  const maxConns = user[limitField] || user.max_connections || 1;

  // Conexiuni active per user per deviceType
  const deviceKey = `connections:${deviceType}:${user.id}`;
  const allConnsKey = `connections:user:${user.id}`;

  const [deviceConns, allConns] = await Promise.all([
    redis.hlen(deviceKey),
    redis.hlen(allConnsKey)
  ]);

  // Verifică dacă același IP+device e deja conectat
  const existingSession = await redis.hget(deviceKey, clientIp);

  if (!existingSession && deviceConns >= maxConns) {
    logger.warn('Connection limit exceeded', {
      userId: user.id, deviceType, deviceConns, maxConns
    });
    return res.status(429).send(`Connection limit exceeded for ${deviceType}`);
  }

  // ── Fetch URL stream ─────────────────────────────────────────────────────
  let streamUrl = null, streamName = '';

  if (pathType === 'live') {
    const stream = await queryOne(
      `SELECT id, name, direct_source, stream_source, tv_archive
       FROM streams WHERE id = ? AND is_active = 1 AND stream_type = 'live'`,
      [streamId]
    );
    if (!stream) return res.status(404).send('Stream not found');

    if (user.bouquet_id) {
      const inBouquet = await queryOne(
        'SELECT 1 FROM bouquet_streams WHERE bouquet_id = ? AND stream_id = ? AND stream_type = "live"',
        [user.bouquet_id, streamId]
      );
      if (!inBouquet) return res.status(403).send('Not in your package');
    }

    streamUrl = stream.direct_source;
    streamName = stream.name;
    if (!streamUrl && stream.stream_source) {
      const sources = Array.isArray(stream.stream_source)
        ? stream.stream_source
        : JSON.parse(stream.stream_source || '[]');
      streamUrl = sources[0] || null;
    }
  } else if (pathType === 'vod') {
    const vod = await queryOne(
      'SELECT id, vod_name, stream_source FROM vod_streams WHERE id = ? AND is_active = 1',
      [streamId]
    );
    if (!vod) return res.status(404).send('VOD not found');
    streamUrl = vod.stream_source;
    streamName = vod.vod_name;
  } else if (pathType === 'series') {
    const episode = await queryOne(
      'SELECT id, title, stream_source FROM episodes WHERE id = ? AND is_active = 1',
      [streamId]
    );
    if (!episode) return res.status(404).send('Episode not found');
    streamUrl = episode.stream_source;
    streamName = episode.title;
  }

  if (!streamUrl) return res.status(503).send('Stream source not available');

  // ── Înregistrare conexiune ───────────────────────────────────────────────
  const sessionToken = uuidv4().replace(/-/g, '');
  const geo = geoip.lookup(clientIp);

  if (!existingSession) {
    const connData = JSON.stringify({
      ip: clientIp,
      streamId,
      streamName,
      streamType: pathType,
      deviceType,
      userAgent: userAgent.substring(0, 200),
      connectedAt: Date.now(),
      lastHeartbeat: Date.now()
    });

    // Salvare în Redis: global + per-device
    await Promise.all([
      redis.hset(allConnsKey, sessionToken, connData),
      redis.expire(allConnsKey, 86400),
      redis.hset(deviceKey, clientIp, sessionToken),
      redis.expire(deviceKey, 86400),
    ]);

    // Log async în MySQL
    query(
      `INSERT INTO connection_logs
         (user_id, stream_id, stream_type, ip_address, user_agent, country, city, device_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, streamId, pathType, clientIp,
       userAgent.substring(0, 499), geo?.country || null, geo?.city || null, deviceType]
    ).catch(e => logger.error('Log insert error', { e: e.message }));
  }

  // ── Curățare la deconectare ──────────────────────────────────────────────
  res.on('close', async () => {
    if (!existingSession) {
      await Promise.all([
        redis.hdel(allConnsKey, sessionToken),
        redis.hdel(deviceKey, clientIp),
      ]);
      query(
        `UPDATE connection_logs SET disconnected_at = NOW(),
           duration_secs = TIMESTAMPDIFF(SECOND, connected_at, NOW())
         WHERE user_id = ? AND ip_address = ? AND device_type = ? AND disconnected_at IS NULL
         ORDER BY connected_at DESC LIMIT 1`,
        [user.id, clientIp, deviceType]
      ).catch(() => {});
    }
  });

  res.redirect(302, streamUrl);
}

module.exports = streamProxy;
