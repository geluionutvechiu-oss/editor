const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, queryOne } = require('../config/database');
const { cache } = require('../config/redis');
const { authenticate, requireRole } = require('../middleware/auth');
const { fetchTMDBSeries, fetchTMDBSeriesSeasons } = require('../services/tmdb');
const logger = require('../config/logger');

// GET /api/series
router.get('/', authenticate, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;
  const categoryId = req.query.category_id;
  const search = req.query.search || '';

  let where = ['s.is_active = 1'];
  let params = [];

  if (req.user.bouquet_id) {
    where.push('EXISTS (SELECT 1 FROM bouquet_streams bs WHERE bs.bouquet_id = ? AND bs.stream_id = s.id AND bs.stream_type = "series")');
    params.push(req.user.bouquet_id);
  }

  if (categoryId) { where.push('s.category_id = ?'); params.push(parseInt(categoryId)); }
  if (search) { where.push('s.name LIKE ?'); params.push(`%${search}%`); }

  const whereStr = where.join(' AND ');

  const [[{ total }]] = await Promise.all([
    query(`SELECT COUNT(*) as total FROM series s WHERE ${whereStr}`, params)
  ]);

  const series = await query(
    `SELECT s.id, s.name, s.cover, s.plot, s.genre, s.releaseDate,
            s.rating, s.backdrop_path, s.youtube_trailer, s.category_id,
            s.last_modified, s.episode_run_time,
            c.category_name,
            COUNT(DISTINCT se.season_num) as num_seasons,
            COUNT(DISTINCT e.id) as num_episodes
     FROM series s
     LEFT JOIN stream_categories c ON c.id = s.category_id
     LEFT JOIN seasons se ON se.series_id = s.id
     LEFT JOIN episodes e ON e.series_id = s.id AND e.is_active = 1
     WHERE ${whereStr}
     GROUP BY s.id
     ORDER BY s.last_modified DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: series,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/series/:id - series details with all seasons/episodes
router.get('/:id', authenticate, async (req, res) => {
  const seriesId = parseInt(req.params.id);

  const series = await queryOne(
    `SELECT s.*, c.category_name FROM series s
     LEFT JOIN stream_categories c ON c.id = s.category_id
     WHERE s.id = ? AND s.is_active = 1`,
    [seriesId]
  );

  if (!series) return res.status(404).json({ success: false, message: 'Series not found' });

  const episodes = await query(
    `SELECT e.id, e.season_num, e.episode_num, e.title, e.movie_image,
            e.container_extension, e.stream_status, e.duration, e.info, e.added
     FROM episodes e
     WHERE e.series_id = ? AND e.is_active = 1
     ORDER BY e.season_num ASC, e.episode_num ASC`,
    [seriesId]
  );

  // Organize by seasons
  const seasons = {};
  for (const ep of episodes) {
    const key = ep.season_num;
    if (!seasons[key]) seasons[key] = { season_num: ep.season_num, episodes: [] };
    seasons[key].episodes.push(ep);
  }

  // Watch history
  const history = await query(
    `SELECT episode_id, position_secs, duration_secs, completed
     FROM user_watch_history
     WHERE user_id = ? AND stream_id = ? AND stream_type = 'series'`,
    [req.user.id, seriesId]
  );
  const historyMap = {};
  for (const h of history) { historyMap[h.episode_id] = h; }

  res.json({
    success: true,
    data: {
      ...series,
      seasons: Object.values(seasons).sort((a, b) => a.season_num - b.season_num),
      watch_history: historyMap
    }
  });
});

// POST /api/series - create series
router.post('/', authenticate, requireRole('admin'), [
  body('name').trim().notEmpty().isLength({ max: 500 }),
  body('category_id').optional().isInt({ min: 1 }),
  body('tmdb_id').optional().isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  let { name, cover, plot, cast, director, genre, releaseDate, category_id, tmdb_id, youtube_trailer } = req.body;

  if (tmdb_id && process.env.TMDB_API_KEY) {
    try {
      const tmdbData = await fetchTMDBSeries(tmdb_id);
      if (tmdbData) {
        name = name || tmdbData.name;
        cover = cover || tmdbData.poster_path;
        plot = plot || tmdbData.overview;
        genre = genre || tmdbData.genres?.map(g => g.name).join(', ');
        releaseDate = releaseDate || tmdbData.first_air_date?.substring(0, 4);
        cast = cast || JSON.stringify(tmdbData.credits?.cast?.slice(0, 15).map(c => c.name) || []);
        director = director || tmdbData.created_by?.[0]?.name;
        youtube_trailer = youtube_trailer || tmdbData.videos?.results?.find(v => v.type === 'Trailer')?.key;
      }
    } catch (err) {
      logger.warn('TMDB series fetch failed', { tmdb_id, err: err.message });
    }
  }

  const [result] = await query(
    `INSERT INTO series (name, cover, plot, cast, director, genre, releaseDate,
      category_id, tmdb_id, youtube_trailer, last_modified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      name, cover || null, plot || null, cast || null, director || null,
      genre || null, releaseDate || null, category_id || null,
      tmdb_id || null, youtube_trailer || null
    ]
  );

  res.status(201).json({ success: true, message: 'Series created', id: result.insertId });
});

// POST /api/series/:id/episodes - add episode
router.post('/:id/episodes', authenticate, requireRole('admin'), [
  body('season_num').isInt({ min: 1, max: 99 }),
  body('episode_num').isInt({ min: 1 }),
  body('stream_source').notEmpty().isURL({ require_protocol: true }),
  body('container_extension').optional().isIn(['mkv', 'mp4', 'avi', 'ts'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const seriesId = parseInt(req.params.id);
  const series = await queryOne('SELECT id FROM series WHERE id = ?', [seriesId]);
  if (!series) return res.status(404).json({ success: false, message: 'Series not found' });

  const { season_num, episode_num, title, stream_source, container_extension, movie_image, duration_secs, duration } = req.body;

  // Ensure season exists
  await query(
    'INSERT IGNORE INTO seasons (series_id, season_num, name) VALUES (?, ?, ?)',
    [seriesId, season_num, `Season ${season_num}`]
  );
  const season = await queryOne('SELECT id FROM seasons WHERE series_id = ? AND season_num = ?', [seriesId, season_num]);

  const [result] = await query(
    `INSERT INTO episodes (series_id, season_id, season_num, episode_num, title,
      stream_source, container_extension, movie_image, duration_secs, duration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      seriesId, season.id, season_num, episode_num, title || null,
      stream_source, container_extension || 'mkv',
      movie_image || null, duration_secs || null, duration || null
    ]
  );

  await query('UPDATE series SET last_modified = NOW() WHERE id = ?', [seriesId]);

  res.status(201).json({ success: true, message: 'Episode added', id: result.insertId });
});

// POST /api/series/:id/episodes/:epId/progress
router.post('/:id/episodes/:epId/progress', authenticate, [
  body('position_secs').isInt({ min: 0 }),
  body('duration_secs').optional().isInt({ min: 0 })
], async (req, res) => {
  const { position_secs, duration_secs } = req.body;
  const seriesId = parseInt(req.params.id);
  const episodeId = parseInt(req.params.epId);
  const completed = duration_secs ? position_secs / duration_secs >= 0.9 : false;

  await query(
    `INSERT INTO user_watch_history (user_id, stream_id, stream_type, episode_id, position_secs, duration_secs, completed)
     VALUES (?, ?, 'series', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE position_secs = ?, duration_secs = ?, completed = ?, watched_at = NOW()`,
    [req.user.id, seriesId, episodeId, position_secs, duration_secs || null, completed ? 1 : 0,
     position_secs, duration_secs || null, completed ? 1 : 0]
  );

  res.json({ success: true });
});

module.exports = router;
