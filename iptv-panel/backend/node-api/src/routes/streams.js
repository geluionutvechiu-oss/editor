const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, queryOne, transaction } = require('../config/database');
const { cache } = require('../config/redis');
const { authenticate, requireRole } = require('../middleware/auth');
const { parseM3U } = require('../services/m3uParser');
const { checkStreamHealth } = require('../services/streamHealth');
const logger = require('../config/logger');
const multer = require('multer');
const axios = require('axios');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// GET /api/streams - list live streams
router.get('/', authenticate, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;
  const categoryId = req.query.category_id;
  const search = req.query.search || '';
  const status = req.query.status || '';

  const cacheKey = `streams:list:${page}:${limit}:${categoryId}:${search}:${status}`;

  if (req.user.role === 'user') {
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);
  }

  let where = ['s.is_active = 1', 's.stream_type = "live"'];
  let params = [];

  if (req.user.role === 'user' && req.user.bouquet_id) {
    where.push('EXISTS (SELECT 1 FROM bouquet_streams bs WHERE bs.bouquet_id = ? AND bs.stream_id = s.id AND bs.stream_type = "live")');
    params.push(req.user.bouquet_id);
  }

  if (categoryId) {
    where.push('s.category_id = ?');
    params.push(parseInt(categoryId));
  }

  if (search) {
    where.push('s.name LIKE ?');
    params.push(`%${search}%`);
  }

  if (status && ['online', 'offline', 'unknown'].includes(status)) {
    where.push('s.stream_status = ?');
    params.push(status);
  }

  const whereStr = where.join(' AND ');

  const [[{ total }]] = await Promise.all([
    query(`SELECT COUNT(*) as total FROM streams s WHERE ${whereStr}`, params)
  ]);

  const streams = await query(
    `SELECT s.id, s.num, s.name, s.stream_display_name, s.stream_icon,
            s.epg_channel_id, s.added, s.category_id, s.tv_archive,
            s.tv_archive_duration, s.stream_status, s.direct_source,
            s.stream_type, s.sort_order,
            c.category_name
     FROM streams s
     LEFT JOIN stream_categories c ON c.id = s.category_id
     WHERE ${whereStr}
     ORDER BY s.num ASC, s.sort_order ASC, s.name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const result = {
    success: true,
    data: streams,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };

  if (req.user.role === 'user') {
    await cache.set(cacheKey, result, 120);
  }

  res.json(result);
});

// GET /api/streams/:id
router.get('/:id', authenticate, async (req, res) => {
  const streamId = parseInt(req.params.id);
  const stream = await queryOne(
    `SELECT s.*, c.category_name
     FROM streams s
     LEFT JOIN stream_categories c ON c.id = s.category_id
     WHERE s.id = ? AND s.is_active = 1`,
    [streamId]
  );

  if (!stream) return res.status(404).json({ success: false, message: 'Stream not found' });

  // Fetch current EPG
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const epg = stream.epg_channel_id ? await queryOne(
    `SELECT title, description, start, end, category, episode_num
     FROM epg_data
     WHERE channel_id = ? AND start <= ? AND end >= ?
     ORDER BY start DESC LIMIT 1`,
    [stream.epg_channel_id, now, now]
  ) : null;

  res.json({ success: true, data: { ...stream, current_epg: epg } });
});

// POST /api/streams - create stream (admin)
router.post('/', authenticate, requireRole('admin'), [
  body('name').trim().notEmpty().isLength({ max: 255 }),
  body('direct_source').notEmpty().isURL({ require_protocol: true }),
  body('category_id').optional().isInt({ min: 1 }),
  body('num').optional().isInt({ min: 1 }),
  body('epg_channel_id').optional().isLength({ max: 255 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const {
    name, stream_display_name, stream_icon, epg_channel_id, direct_source,
    category_id, num, tv_archive, tv_archive_duration, stream_source, notes
  } = req.body;

  const [result] = await query(
    `INSERT INTO streams (name, stream_display_name, stream_icon, epg_channel_id,
      direct_source, category_id, num, tv_archive, tv_archive_duration,
      stream_source, stream_type, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', ?)`,
    [
      name, stream_display_name || name, stream_icon || null, epg_channel_id || null,
      direct_source, category_id || null, num || null,
      tv_archive ? 1 : 0, tv_archive_duration || 0,
      stream_source ? JSON.stringify(stream_source) : null, notes || null
    ]
  );

  await cache.delPattern('streams:list:*');
  logger.info('Stream created', { createdBy: req.user.id, streamId: result.insertId });
  res.status(201).json({ success: true, message: 'Stream created', id: result.insertId });
});

// PUT /api/streams/:id
router.put('/:id', authenticate, requireRole('admin'), [
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('direct_source').optional().isURL({ require_protocol: true })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const streamId = parseInt(req.params.id);
  const stream = await queryOne('SELECT id FROM streams WHERE id = ?', [streamId]);
  if (!stream) return res.status(404).json({ success: false, message: 'Stream not found' });

  const allowed = ['name', 'stream_display_name', 'stream_icon', 'epg_channel_id',
                   'direct_source', 'category_id', 'num', 'tv_archive',
                   'tv_archive_duration', 'is_active', 'notes', 'sort_order'];

  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No fields to update' });
  }

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await query(`UPDATE streams SET ${sets} WHERE id = ?`, [...Object.values(updates), streamId]);
  await cache.delPattern('streams:list:*');

  res.json({ success: true, message: 'Stream updated' });
});

// DELETE /api/streams/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const streamId = parseInt(req.params.id);
  await query('DELETE FROM streams WHERE id = ?', [streamId]);
  await query('DELETE FROM bouquet_streams WHERE stream_id = ? AND stream_type = "live"', [streamId]);
  await cache.delPattern('streams:list:*');
  res.json({ success: true, message: 'Stream deleted' });
});

// POST /api/streams/bulk-import - import from M3U URL or file
router.post('/bulk-import', authenticate, requireRole('admin'), upload.single('file'), async (req, res) => {
  let m3uContent = '';

  if (req.file) {
    m3uContent = req.file.buffer.toString('utf-8');
  } else if (req.body.url) {
    try {
      const response = await axios.get(req.body.url, {
        timeout: 120000, // 2 min for URL fetch
        maxContentLength: 100 * 1024 * 1024,
        headers: { 'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18' }
      });
      m3uContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    } catch (err) {
      return res.status(400).json({ success: false, message: `Failed to fetch M3U: ${err.message}` });
    }
  } else {
    return res.status(400).json({ success: false, message: 'Provide file or URL' });
  }

  const parsed = parseM3U(m3uContent);
  if (!parsed.length) {
    return res.status(400).json({ success: false, message: 'No valid streams found in M3U' });
  }

  const defaultCategoryId = req.body.category_id ? parseInt(req.body.category_id) : null;
  let imported = 0, skipped = 0, errors = 0;

  // Pre-build category map to avoid N queries per stream
  const categoryMap = new Map(); // "name:type" -> id

  // Collect all unique groups from the M3U
  const uniqueGroups = [...new Set(
    parsed
      .filter(item => item.group && !defaultCategoryId)
      .map(item => `${item.group.substring(0, 150)}:${item.stream_type || 'live'}`)
  )];

  // Fetch or create all categories upfront
  for (const groupKey of uniqueGroups) {
    const [groupName, streamType] = groupKey.split(':');
    let cat = await queryOne(
      'SELECT id FROM stream_categories WHERE category_name = ? AND category_type = ?',
      [groupName, streamType]
    );
    if (!cat) {
      const result = await query(
        'INSERT INTO stream_categories (category_name, category_type) VALUES (?, ?)',
        [groupName, streamType]
      );
      categoryMap.set(groupKey, result.insertId);
    } else {
      categoryMap.set(groupKey, cat.id);
    }
  }

  // Bulk insert in batches of 500 rows
  const BATCH_SIZE = 500;
  for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
    const batch = parsed.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, 0)').join(', ');
    const values = [];

    for (const item of batch) {
      let categoryId = defaultCategoryId;
      if (item.group && !defaultCategoryId) {
        categoryId = categoryMap.get(`${item.group.substring(0, 150)}:${item.stream_type || 'live'}`) || null;
      }
      values.push(
        item.name.substring(0, 255),
        item.name.substring(0, 255),
        item.logo ? item.logo.substring(0, 999) : null,
        item.tvg_id ? item.tvg_id.substring(0, 255) : null,
        item.url.substring(0, 1999),
        categoryId,
        item.stream_type || 'live'
      );
    }

    try {
      const result = await query(
        `INSERT IGNORE INTO streams (name, stream_display_name, stream_icon, epg_channel_id,
          direct_source, category_id, stream_type, tv_archive)
         VALUES ${placeholders}`,
        values
      );
      imported += result.affectedRows || batch.length;
      skipped += batch.length - (result.affectedRows || batch.length);
    } catch (e) {
      logger.error('Bulk insert batch error', { batch: i, err: e.message });
      errors += batch.length;
    }
  }

  await cache.delPattern('streams:list:*');
  logger.info('Bulk import', { by: req.user.id, total: parsed.length, imported, skipped, errors });

  res.json({
    success: true,
    message: `Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`,
    stats: { total: parsed.length, imported, skipped, errors }
  });
});

// GET /api/streams/:id/health - check stream URL
router.get('/:id/health', authenticate, requireRole('admin'), async (req, res) => {
  const stream = await queryOne('SELECT id, name, direct_source FROM streams WHERE id = ?', [parseInt(req.params.id)]);
  if (!stream) return res.status(404).json({ success: false, message: 'Stream not found' });

  const result = await checkStreamHealth(stream.direct_source);
  await query(
    'UPDATE streams SET stream_status = ?, last_status_check = NOW() WHERE id = ?',
    [result.online ? 'online' : 'offline', stream.id]
  );

  res.json({ success: true, data: result });
});

// GET /api/streams/categories - list categories
router.get('/categories/list', authenticate, async (req, res) => {
  const cacheKey = `stream_categories:live`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached });

  const categories = await query(
    'SELECT id, category_name, parent_id, sort_order FROM stream_categories WHERE category_type = "live" AND is_active = 1 ORDER BY sort_order ASC, category_name ASC'
  );

  await cache.set(cacheKey, categories, 600);
  res.json({ success: true, data: categories });
});

module.exports = router;
