const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, queryOne } = require('../config/database');
const { cache } = require('../config/redis');
const { authenticate, requireRole } = require('../middleware/auth');
const { fetchTMDBMovie, fetchTMDBSeries } = require('../services/tmdb');
const logger = require('../config/logger');

// GET /api/vod - list VOD
router.get('/', authenticate, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;
  const categoryId = req.query.category_id;
  const search = req.query.search || '';
  const genre = req.query.genre || '';
  const year = req.query.year || '';
  const sortBy = ['vod_name', 'releaseDate', 'movie_rating', 'added'].includes(req.query.sort_by)
    ? req.query.sort_by : 'added';
  const sortDir = req.query.sort_dir === 'ASC' ? 'ASC' : 'DESC';

  let where = ['v.is_active = 1'];
  let params = [];

  if (req.user.bouquet_id) {
    where.push('EXISTS (SELECT 1 FROM bouquet_streams bs WHERE bs.bouquet_id = ? AND bs.stream_id = v.id AND bs.stream_type = "vod")');
    params.push(req.user.bouquet_id);
  }

  if (categoryId) { where.push('v.category_id = ?'); params.push(parseInt(categoryId)); }
  if (search) { where.push('v.vod_name LIKE ?'); params.push(`%${search}%`); }
  if (genre) { where.push('v.genre LIKE ?'); params.push(`%${genre}%`); }
  if (year) { where.push('YEAR(v.releaseDate) = ?'); params.push(parseInt(year)); }

  const whereStr = where.join(' AND ');

  const [[{ total }]] = await Promise.all([
    query(`SELECT COUNT(*) as total FROM vod_streams v WHERE ${whereStr}`, params)
  ]);

  const vods = await query(
    `SELECT v.id, v.vod_name, v.stream_icon, v.movie_image, v.releaseDate,
            v.youtube_trailer, v.genre, v.plot, v.cast, v.director,
            v.movie_rating, v.movie_rating_count, v.duration, v.container_extension,
            v.category_id, v.added, v.stream_status,
            c.category_name
     FROM vod_streams v
     LEFT JOIN stream_categories c ON c.id = v.category_id
     WHERE ${whereStr}
     ORDER BY v.${sortBy} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: vods,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/vod/:id
router.get('/:id', authenticate, async (req, res) => {
  const vodId = parseInt(req.params.id);
  const vod = await queryOne(
    `SELECT v.*, c.category_name FROM vod_streams v
     LEFT JOIN stream_categories c ON c.id = v.category_id
     WHERE v.id = ? AND v.is_active = 1`,
    [vodId]
  );

  if (!vod) return res.status(404).json({ success: false, message: 'VOD not found' });

  // Get watch progress for this user
  const watchHistory = await queryOne(
    'SELECT position_secs, duration_secs, completed FROM user_watch_history WHERE user_id = ? AND stream_id = ? AND stream_type = "vod"',
    [req.user.id, vodId]
  );

  res.json({ success: true, data: { ...vod, watch_history: watchHistory } });
});

// POST /api/vod - create VOD
router.post('/', authenticate, requireRole('admin'), [
  body('vod_name').trim().notEmpty().isLength({ max: 500 }),
  body('stream_source').notEmpty().isURL({ require_protocol: true }),
  body('container_extension').optional().isIn(['mkv', 'mp4', 'avi', 'mov', 'ts']),
  body('category_id').optional().isInt({ min: 1 }),
  body('tmdb_id').optional().isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  let {
    vod_name, stream_source, container_extension, category_id, tmdb_id,
    stream_icon, releaseDate, youtube_trailer, genre, plot, cast,
    director, movie_rating, duration_secs, duration
  } = req.body;

  // Fetch TMDB metadata if ID provided
  if (tmdb_id && process.env.TMDB_API_KEY) {
    try {
      const tmdbData = await fetchTMDBMovie(tmdb_id);
      if (tmdbData) {
        vod_name = vod_name || tmdbData.title;
        stream_icon = stream_icon || tmdbData.poster_path;
        releaseDate = releaseDate || tmdbData.release_date;
        genre = genre || tmdbData.genres?.map(g => g.name).join(', ');
        plot = plot || tmdbData.overview;
        cast = cast || JSON.stringify(tmdbData.credits?.cast?.slice(0, 10).map(c => c.name) || []);
        director = director || tmdbData.credits?.crew?.find(c => c.job === 'Director')?.name;
        movie_rating = movie_rating || tmdbData.vote_average;
        youtube_trailer = youtube_trailer || tmdbData.videos?.results?.find(v => v.type === 'Trailer')?.key;
      }
    } catch (err) {
      logger.warn('TMDB fetch failed', { tmdb_id, err: err.message });
    }
  }

  const [result] = await query(
    `INSERT INTO vod_streams (vod_name, stream_source, container_extension, category_id,
      stream_icon, movie_image, releaseDate, youtube_trailer, genre, plot, cast,
      director, movie_rating, duration_secs, duration, tmdb_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      vod_name, stream_source, container_extension || 'mkv', category_id || null,
      stream_icon || null, stream_icon || null, releaseDate || null,
      youtube_trailer || null, genre || null, plot || null,
      cast || null, director || null, movie_rating || null,
      duration_secs || null, duration || null, tmdb_id || null
    ]
  );

  await cache.delPattern('vod:list:*');
  res.status(201).json({ success: true, message: 'VOD created', id: result.insertId });
});

// POST /api/vod/:id/refresh-tmdb - refresh metadata from TMDB
router.post('/:id/refresh-tmdb', authenticate, requireRole('admin'), async (req, res) => {
  const vodId = parseInt(req.params.id);
  const vod = await queryOne('SELECT id, vod_name, tmdb_id FROM vod_streams WHERE id = ?', [vodId]);
  if (!vod) return res.status(404).json({ success: false, message: 'VOD not found' });
  if (!process.env.TMDB_API_KEY) {
    return res.status(503).json({ success: false, message: 'TMDB API key not configured' });
  }

  let tmdbId = vod.tmdb_id;
  if (!tmdbId && req.body.tmdb_id) {
    tmdbId = parseInt(req.body.tmdb_id);
  }

  if (!tmdbId) {
    return res.status(400).json({ success: false, message: 'No TMDB ID available' });
  }

  const tmdbData = await fetchTMDBMovie(tmdbId);
  if (!tmdbData) {
    return res.status(404).json({ success: false, message: 'TMDB movie not found' });
  }

  await query(
    `UPDATE vod_streams SET
      vod_name = ?, stream_icon = ?, movie_image = ?,
      releaseDate = ?, genre = ?, plot = ?, cast = ?,
      director = ?, movie_rating = ?, movie_rating_count = ?,
      youtube_trailer = ?, backdrop_path = ?, tmdb_id = ?,
      duration_secs = ?, duration = ?
     WHERE id = ?`,
    [
      tmdbData.title, tmdbData.poster_path, tmdbData.poster_path,
      tmdbData.release_date || null,
      tmdbData.genres?.map(g => g.name).join(', ') || null,
      tmdbData.overview || null,
      JSON.stringify(tmdbData.credits?.cast?.slice(0, 15).map(c => c.name) || []),
      tmdbData.credits?.crew?.find(c => c.job === 'Director')?.name || null,
      tmdbData.vote_average || null, tmdbData.vote_count || null,
      tmdbData.videos?.results?.find(v => v.type === 'Trailer')?.key || null,
      JSON.stringify(tmdbData.backdrop_path ? [tmdbData.backdrop_path] : []),
      tmdbId,
      tmdbData.runtime ? tmdbData.runtime * 60 : null,
      tmdbData.runtime ? `${tmdbData.runtime} min` : null,
      vodId
    ]
  );

  res.json({ success: true, message: 'Metadata refreshed', tmdb_id: tmdbId });
});

// POST /api/vod/:id/progress - save watch progress
router.post('/:id/progress', authenticate, [
  body('position_secs').isInt({ min: 0 }),
  body('duration_secs').optional().isInt({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { position_secs, duration_secs } = req.body;
  const vodId = parseInt(req.params.id);
  const completed = duration_secs ? position_secs / duration_secs >= 0.9 : false;

  await query(
    `INSERT INTO user_watch_history (user_id, stream_id, stream_type, position_secs, duration_secs, completed)
     VALUES (?, ?, 'vod', ?, ?, ?)
     ON DUPLICATE KEY UPDATE position_secs = ?, duration_secs = ?, completed = ?, watched_at = NOW()`,
    [req.user.id, vodId, position_secs, duration_secs || null, completed ? 1 : 0,
     position_secs, duration_secs || null, completed ? 1 : 0]
  );

  res.json({ success: true });
});

// GET /api/vod/continue-watching
router.get('/user/continue-watching', authenticate, async (req, res) => {
  const history = await query(
    `SELECT h.stream_id, h.stream_type, h.position_secs, h.duration_secs,
            h.completed, h.watched_at,
            v.vod_name, v.stream_icon, v.movie_image, v.duration, v.container_extension
     FROM user_watch_history h
     JOIN vod_streams v ON v.id = h.stream_id AND h.stream_type = 'vod'
     WHERE h.user_id = ? AND h.completed = 0
     ORDER BY h.watched_at DESC
     LIMIT 20`,
    [req.user.id]
  );

  res.json({ success: true, data: history });
});

module.exports = router;
