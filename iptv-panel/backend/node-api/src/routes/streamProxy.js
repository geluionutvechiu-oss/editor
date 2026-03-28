/**
 * Stream proxy/redirect handler
 * Handles: /live/:user/:pass/:id.ext
 *          /movie/:user/:pass/:id.ext
 *          /series/:user/:pass/:id.ext
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { queryOne, query } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../config/logger');
const geoip = require('geoip-lite');

async function streamProxy(req, res) {
  const { username, password, streamId: rawStreamId } = req.params;
  const pathType = req.path.startsWith('/live') ? 'live'
    : req.path.startsWith('/movie') ? 'vod'
    : req.path.startsWith('/series') ? 'series'
    : 'live';

  // Extract stream ID (remove extension)
  const streamId = parseInt(rawStreamId.replace(/\.\w+$/, ''));
  if (isNaN(streamId)) {
    return res.status(400).send('Invalid stream ID');
  }

  const clientIp = (req.ip || '').replace('::ffff:', '');

  // Authenticate user (cache for 60s to reduce DB load)
  const userCacheKey = `auth:${username}:${password}`;
  let user = await cache.get(userCacheKey);

  if (!user) {
    user = await queryOne(
      `SELECT id, username, password, role, is_active, is_banned, exp_date,
              max_connections, allowed_output_formats, bouquet_id, ip_whitelist
       FROM users WHERE username = ?`,
      [username]
    );

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).send('Unauthorized');
    }

    await cache.set(userCacheKey, user, 60);
  }

  if (!user.is_active || user.is_banned) {
    return res.status(403).send('Account disabled');
  }

  if (user.exp_date && new Date(user.exp_date) < new Date()) {
    return res.status(403).send('Subscription expired');
  }

  // Check IP whitelist
  if (user.ip_whitelist) {
    const allowed = Array.isArray(user.ip_whitelist) ? user.ip_whitelist : JSON.parse(user.ip_whitelist || '[]');
    if (allowed.length > 0 && !allowed.includes(clientIp)) {
      return res.status(403).send('IP not allowed');
    }
  }

  // Check connection limit
  const activeConns = await cache.getUserConnectionCount(user.id);
  const sessionKey = `${user.id}:${clientIp}`;

  // Check if this IP already has a session for this user (don't double-count)
  const existingSessions = await cache.getUserConnections(user.id);
  const existingFromIp = existingSessions.find(s => s.ip === clientIp);

  if (!existingFromIp && activeConns >= user.max_connections) {
    logger.warn('Connection limit exceeded', { userId: user.id, activeConns, max: user.max_connections });
    return res.status(429).send('Connection limit exceeded');
  }

  // Fetch stream source
  let streamUrl = null;
  let streamName = '';

  if (pathType === 'live') {
    const stream = await queryOne(
      `SELECT id, name, direct_source, stream_source, tv_archive
       FROM streams WHERE id = ? AND is_active = 1 AND stream_type = 'live'`,
      [streamId]
    );
    if (!stream) return res.status(404).send('Stream not found');

    // Bouquet check
    if (user.bouquet_id) {
      const inBouquet = await queryOne(
        'SELECT 1 FROM bouquet_streams WHERE bouquet_id = ? AND stream_id = ? AND stream_type = "live"',
        [user.bouquet_id, streamId]
      );
      if (!inBouquet) return res.status(403).send('Not in your package');
    }

    streamUrl = stream.direct_source;
    streamName = stream.name;

    // Try failover sources if primary fails
    if (!streamUrl && stream.stream_source) {
      const sources = Array.isArray(stream.stream_source) ? stream.stream_source : JSON.parse(stream.stream_source || '[]');
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

  if (!streamUrl) {
    return res.status(503).send('Stream source not available');
  }

  // Log connection
  const sessionToken = existingFromIp?.token || uuidv4().replace(/-/g, '');
  const geo = geoip.lookup(clientIp);

  if (!existingFromIp) {
    await cache.addActiveConnection(user.id, sessionToken, {
      ip: clientIp,
      streamId,
      streamType: pathType,
      userAgent: req.headers['user-agent']?.substring(0, 499),
      lastHeartbeat: Date.now()
    });

    // Log to DB async
    query(
      `INSERT INTO connection_logs (user_id, stream_id, stream_type, ip_address, user_agent, country, city)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id, streamId, pathType, clientIp,
        req.headers['user-agent']?.substring(0, 499) || '',
        geo?.country || null, geo?.city || null
      ]
    ).catch(err => logger.error('Connection log insert error', { err: err.message }));
  }

  // Handle disconnect
  res.on('close', async () => {
    if (!existingFromIp) {
      await cache.removeActiveConnection(user.id, sessionToken);
      // Update disconnection time in logs
      query(
        'UPDATE connection_logs SET disconnected_at = NOW() WHERE user_id = ? AND ip_address = ? AND disconnected_at IS NULL ORDER BY connected_at DESC LIMIT 1',
        [user.id, clientIp]
      ).catch(() => {});
    }
  });

  // Redirect to actual stream URL
  // In production, you might want to proxy through nginx for better performance
  res.redirect(302, streamUrl);
}

module.exports = streamProxy;
