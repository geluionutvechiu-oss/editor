const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, queryOne } = require('../config/database');
const { cache } = require('../config/redis');
const { authenticate, requireRole } = require('../middleware/auth');
const { refreshEpgSource } = require('../services/epgProcessor');
const logger = require('../config/logger');

// GET /api/epg/sources
router.get('/sources', authenticate, requireRole('admin'), async (req, res) => {
  const sources = await query('SELECT * FROM epg_sources ORDER BY name ASC');
  res.json({ success: true, data: sources });
});

// POST /api/epg/sources
router.post('/sources', authenticate, requireRole('admin'), [
  body('name').trim().notEmpty().isLength({ max: 150 }),
  body('url').notEmpty().isURL({ require_protocol: true }),
  body('update_frequency_hours').optional().isInt({ min: 1, max: 168 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, url, update_frequency_hours, encoding } = req.body;
  const [result] = await query(
    'INSERT INTO epg_sources (name, url, update_frequency_hours, encoding) VALUES (?, ?, ?, ?)',
    [name, url, update_frequency_hours || 12, encoding || 'UTF-8']
  );

  res.status(201).json({ success: true, message: 'EPG source added', id: result.insertId });
});

// DELETE /api/epg/sources/:id
router.delete('/sources/:id', authenticate, requireRole('admin'), async (req, res) => {
  const sourceId = parseInt(req.params.id);
  await query('DELETE FROM epg_sources WHERE id = ?', [sourceId]);
  await cache.delPattern('xmltv:*');
  res.json({ success: true, message: 'EPG source deleted' });
});

// POST /api/epg/sources/:id/refresh - manually trigger EPG refresh
router.post('/sources/:id/refresh', authenticate, requireRole('admin'), async (req, res) => {
  const sourceId = parseInt(req.params.id);
  const source = await queryOne('SELECT * FROM epg_sources WHERE id = ?', [sourceId]);
  if (!source) return res.status(404).json({ success: false, message: 'Source not found' });

  res.json({ success: true, message: 'EPG refresh started in background' });

  // Run async in background
  refreshEpgSource(source).catch(err => {
    logger.error('EPG refresh failed', { sourceId, err: err.message });
  });
});

// GET /api/epg/channels - list all EPG channels
router.get('/channels', authenticate, requireRole('admin'), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  let where = ['1=1'];
  let params = [];
  if (search) {
    where.push('(ec.channel_id LIKE ? OR ec.display_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const [[{ total }]] = await Promise.all([
    query(`SELECT COUNT(*) as total FROM epg_channels ec WHERE ${where.join(' AND ')}`, params)
  ]);

  const channels = await query(
    `SELECT ec.*, es.name as source_name
     FROM epg_channels ec
     JOIN epg_sources es ON es.id = ec.source_id
     WHERE ${where.join(' AND ')}
     ORDER BY ec.display_name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: channels,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/epg/now - current programs for all channels
router.get('/now', authenticate, async (req, res) => {
  const channelIds = req.query.channel_ids ? req.query.channel_ids.split(',') : [];
  if (!channelIds.length) {
    return res.status(400).json({ success: false, message: 'channel_ids required' });
  }

  const placeholders = channelIds.map(() => '?').join(',');
  const programs = await query(
    `SELECT channel_id, title, description, start, end, category
     FROM epg_data
     WHERE channel_id IN (${placeholders})
       AND start <= NOW() AND end >= NOW()
     ORDER BY start DESC`,
    channelIds
  );

  const result = {};
  for (const p of programs) {
    result[p.channel_id] = p;
  }

  res.json({ success: true, data: result });
});

// GET /api/epg/guide - program guide for a channel
router.get('/guide/:channelId', authenticate, async (req, res) => {
  const channelId = req.params.channelId;
  const daysBack = Math.min(3, parseInt(req.query.days_back) || 1);
  const daysForward = Math.min(7, parseInt(req.query.days_forward) || 3);

  const cacheKey = `epg:guide:${channelId}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached });

  const programs = await query(
    `SELECT channel_id, title, description, start, end, category, episode_num, icon
     FROM epg_data
     WHERE channel_id = ?
       AND start >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND start <= DATE_ADD(NOW(), INTERVAL ? DAY)
     ORDER BY start ASC`,
    [channelId, daysBack, daysForward]
  );

  await cache.set(cacheKey, programs, 900);
  res.json({ success: true, data: programs });
});

module.exports = router;
