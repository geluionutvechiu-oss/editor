/**
 * Xtream Codes Compatible API
 * 100% compatible with Xtream Codes panel API
 * Used by IPTV clients: Tivimate, IPTV Smarters, GSE, VLC, etc.
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');
const { cache } = require('../config/redis');
const { xtreamLimiter } = require('../middleware/rateLimiter');
const logger = require('../config/logger');
const geoip = require('geoip-lite');

// Server info pulled from settings
async function getServerInfo() {
  const cached = await cache.get('server_info');
  if (cached) return cached;

  const settings = await query('SELECT `key`, `value` FROM settings WHERE `key` IN ("panel_url", "panel_name", "server_timezone")');
  const map = {};
  settings.forEach(s => { map[s.key] = s.value; });

  const primaryServer = await queryOne('SELECT domain, http_port, https_port, server_protocol FROM servers WHERE status = "online" ORDER BY is_load_balancer DESC, weight DESC LIMIT 1');

  const info = {
    url: map.panel_url || 'http://localhost',
    port: primaryServer?.http_port || 8080,
    https_port: primaryServer?.https_port || 8443,
    server_protocol: primaryServer?.server_protocol || 'http',
    rtmp_port: 1935,
    timezone: map.server_timezone || 'UTC',
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  await cache.set('server_info', info, 300);
  return info;
}

async function authenticateXtream(username, password) {
  const user = await queryOne(
    `SELECT id, username, password, role, is_active, is_banned, ban_reason,
            exp_date, max_connections, allowed_output_formats, bouquet_id,
            timezone, member_since, ip_whitelist
     FROM users WHERE username = ?`,
    [username]
  );

  if (!user) return null;
  if (!await bcrypt.compare(password, user.password)) return null;
  if (!user.is_active || user.is_banned) return null;
  if (user.exp_date && new Date(user.exp_date) < new Date()) return null;

  return user;
}

function buildUserInfo(user, serverInfo) {
  const expUnix = user.exp_date ? Math.floor(new Date(user.exp_date).getTime() / 1000) : null;
  const memberUnix = Math.floor(new Date(user.member_since).getTime() / 1000);
  const activeConns = 0; // Will be set by caller

  return {
    username: user.username,
    password: '***',
    message: '',
    auth: 1,
    status: 'Active',
    exp_date: expUnix ? String(expUnix) : null,
    is_trial: user.trial_mode ? '1' : '0',
    active_cons: String(activeConns),
    created_at: String(memberUnix),
    max_connections: String(user.max_connections),
    allowed_output_formats: user.allowed_output_formats
      ? user.allowed_output_formats.split(',')
      : ['m3u8', 'ts']
  };
}

// Main Xtream API endpoint: /player_api.php
router.get('/player_api.php', xtreamLimiter, async (req, res) => {
  const { username, password, action, category_id, series_id, vod_id, stream_id, limit: qLimit, page: qPage, type } = req.query;

  const clientIp = (req.ip || '').replace('::ffff:', '');
  const serverInfo = await getServerInfo();

  // Authentication
  const user = await authenticateXtream(username, password);
  if (!user) {
    logger.warn('Xtream auth failed', { username, ip: clientIp });
    return res.json({
      user_info: { auth: 0 },
      server_info: serverInfo
    });
  }

  const activeConns = await cache.getUserConnectionCount(user.id);
  const userInfo = buildUserInfo(user, serverInfo);
  userInfo.active_cons = String(activeConns);

  // No action = login/auth response
  if (!action) {
    await query('UPDATE users SET last_login = NOW(), last_login_ip = ? WHERE id = ?', [clientIp, user.id]);
    return res.json({
      user_info: userInfo,
      server_info: serverInfo
    });
  }

  // Helper to build stream URL
  const baseUrl = serverInfo.url;
  const buildLiveUrl = (streamId, ext) => `${baseUrl}/live/${username}/${password}/${streamId}.${ext}`;
  const buildVodUrl = (streamId, ext) => `${baseUrl}/movie/${username}/${password}/${streamId}.${ext}`;
  const buildSeriesUrl = (streamId, ext) => `${baseUrl}/series/${username}/${password}/${streamId}.${ext}`;

  switch (action) {
    // ============= LIVE =============
    case 'get_live_categories': {
      let where = ['sc.category_type = "live" AND sc.is_active = 1'];
      const params = [];
      if (user.bouquet_id) {
        where.push(`EXISTS (
          SELECT 1 FROM bouquet_streams bs
          JOIN streams s ON s.id = bs.stream_id
          WHERE bs.bouquet_id = ? AND bs.stream_type = 'live' AND s.category_id = sc.id
        )`);
        params.push(user.bouquet_id);
      }
      const cats = await query(
        `SELECT id as category_id, category_name, parent_id as parent_id
         FROM stream_categories sc
         WHERE ${where.join(' AND ')}
         ORDER BY sort_order ASC, category_name ASC`,
        params
      );
      return res.json(cats);
    }

    case 'get_live_streams': {
      let where = ['s.is_active = 1', 's.stream_type = "live"'];
      const params = [];
      if (category_id) { where.push('s.category_id = ?'); params.push(parseInt(category_id)); }
      if (user.bouquet_id) {
        where.push('EXISTS (SELECT 1 FROM bouquet_streams bs WHERE bs.bouquet_id = ? AND bs.stream_id = s.id AND bs.stream_type = "live")');
        params.push(user.bouquet_id);
      }

      const streams = await query(
        `SELECT s.id as stream_id, s.num, s.name, s.stream_display_name,
                s.stream_icon, s.epg_channel_id as epg_channel_id,
                s.added, s.category_id, s.custom_sid, s.tv_archive,
                s.direct_source, s.tv_archive_duration,
                CASE WHEN s.stream_status = 'online' THEN 1 ELSE 0 END as stream_status
         FROM streams s
         WHERE ${where.join(' AND ')}
         ORDER BY s.num ASC, s.sort_order ASC`,
        params
      );

      const outputFormat = user.allowed_output_formats?.includes('ts') ? 'ts' : 'm3u8';
      const result = streams.map(s => ({
        ...s,
        stream_id: s.stream_id,
        stream_icon: s.stream_icon || '',
        epg_channel_id: s.epg_channel_id || '',
        direct_source: buildLiveUrl(s.stream_id, outputFormat)
      }));

      return res.json(result);
    }

    // ============= VOD =============
    case 'get_vod_categories': {
      let where = ['sc.category_type = "vod" AND sc.is_active = 1'];
      const params = [];
      if (user.bouquet_id) {
        where.push(`EXISTS (
          SELECT 1 FROM bouquet_streams bs
          JOIN vod_streams v ON v.id = bs.stream_id
          WHERE bs.bouquet_id = ? AND bs.stream_type = 'vod' AND v.category_id = sc.id
        )`);
        params.push(user.bouquet_id);
      }
      const cats = await query(
        `SELECT id as category_id, category_name, parent_id FROM stream_categories sc
         WHERE ${where.join(' AND ')}
         ORDER BY sort_order ASC, category_name ASC`,
        params
      );
      return res.json(cats);
    }

    case 'get_vod_streams': {
      let where = ['v.is_active = 1'];
      const params = [];
      if (category_id) { where.push('v.category_id = ?'); params.push(parseInt(category_id)); }
      if (user.bouquet_id) {
        where.push('EXISTS (SELECT 1 FROM bouquet_streams bs WHERE bs.bouquet_id = ? AND bs.stream_id = v.id AND bs.stream_type = "vod")');
        params.push(user.bouquet_id);
      }

      const vods = await query(
        `SELECT v.id as stream_id, v.vod_name as name, v.stream_icon, v.added,
                v.category_id, v.container_extension, v.custom_sid,
                v.releaseDate, v.youtube_trailer, v.genre, v.plot,
                v.cast, v.director, v.movie_rating, v.duration_secs,
                v.duration, v.tmdb_id, v.movie_image,
                1 as stream_status
         FROM vod_streams v
         WHERE ${where.join(' AND ')}
         ORDER BY v.added DESC`,
        params
      );

      const result = vods.map(v => ({
        ...v,
        stream_id: v.stream_id,
        direct_source: buildVodUrl(v.stream_id, v.container_extension || 'mkv')
      }));

      return res.json(result);
    }

    case 'get_vod_info': {
      if (!vod_id) return res.status(400).json({ error: 'vod_id required' });
      const vod = await queryOne(
        `SELECT v.*, c.category_name FROM vod_streams v
         LEFT JOIN stream_categories c ON c.id = v.category_id
         WHERE v.id = ?`,
        [parseInt(vod_id)]
      );
      if (!vod) return res.status(404).json({ error: 'not found' });

      return res.json({
        info: {
          tmdb_id: vod.tmdb_id,
          name: vod.vod_name,
          o_name: vod.vod_name,
          cover_big: vod.movie_image || vod.stream_icon,
          movie_image: vod.movie_image || vod.stream_icon,
          releasedate: vod.releaseDate,
          episode_run_time: vod.duration_secs ? Math.floor(vod.duration_secs / 60) : null,
          youtube_trailer: vod.youtube_trailer,
          director: vod.director,
          actors: vod.cast,
          cast: vod.cast,
          description: vod.plot,
          plot: vod.plot,
          age: vod.age,
          country: null,
          genre: vod.genre,
          backdrop_path: vod.backdrop_path || [],
          duration_secs: vod.duration_secs,
          duration: vod.duration,
          bitrate: vod.bitrate,
          rating: vod.movie_rating,
          rating_count_kilos: vod.movie_rating_count,
          video: vod.video,
          audio: vod.audio
        },
        movie_data: {
          stream_id: vod.id,
          name: vod.vod_name,
          added: String(Math.floor(new Date(vod.added).getTime() / 1000)),
          category_id: String(vod.category_id),
          container_extension: vod.container_extension,
          info: {},
          custom_sid: vod.custom_sid || '',
          direct_source: buildVodUrl(vod.id, vod.container_extension)
        }
      });
    }

    // ============= SERIES =============
    case 'get_series_categories': {
      const cats = await query(
        `SELECT id as category_id, category_name, parent_id
         FROM stream_categories
         WHERE category_type = "series" AND is_active = 1
         ORDER BY sort_order ASC, category_name ASC`
      );
      return res.json(cats);
    }

    case 'get_series': {
      let where = ['s.is_active = 1'];
      const params = [];
      if (category_id) { where.push('s.category_id = ?'); params.push(parseInt(category_id)); }

      const series = await query(
        `SELECT s.id as series_id, s.name, s.cover, s.plot, s.cast, s.director,
                s.genre, s.releaseDate, s.last_modified, s.rating, s.rating_5based,
                s.backdrop_path, s.youtube_trailer, s.category_id, s.episode_run_time,
                COUNT(DISTINCT e.id) as num_episodes
         FROM series s
         LEFT JOIN episodes e ON e.series_id = s.id AND e.is_active = 1
         WHERE ${where.join(' AND ')}
         GROUP BY s.id
         ORDER BY s.last_modified DESC`,
        params
      );

      return res.json(series);
    }

    case 'get_series_info': {
      if (!series_id) return res.status(400).json({ error: 'series_id required' });
      const sid = parseInt(series_id);

      const series = await queryOne('SELECT * FROM series WHERE id = ?', [sid]);
      if (!series) return res.status(404).json({ error: 'not found' });

      const episodes = await query(
        `SELECT id, season_num, episode_num, title, movie_image,
                container_extension, stream_status, duration_secs, duration, info, added
         FROM episodes WHERE series_id = ? AND is_active = 1
         ORDER BY season_num ASC, episode_num ASC`,
        [sid]
      );

      const seasons = {};
      for (const ep of episodes) {
        const key = String(ep.season_num);
        if (!seasons[key]) seasons[key] = {};
        const epInfo = typeof ep.info === 'object' ? ep.info : {};
        seasons[key][String(ep.episode_num)] = {
          id: ep.id,
          episode_num: ep.episode_num,
          title: ep.title || `Episode ${ep.episode_num}`,
          container_extension: ep.container_extension,
          info: {
            ...epInfo,
            movie_image: ep.movie_image || '',
            plot: epInfo.plot || '',
            duration_secs: ep.duration_secs,
            duration: ep.duration,
            bitrate: epInfo.bitrate
          },
          direct_source: buildSeriesUrl(ep.id, ep.container_extension),
          added: String(Math.floor(new Date(ep.added).getTime() / 1000))
        };
      }

      return res.json({
        info: {
          name: series.name,
          cover: series.cover,
          plot: series.plot,
          cast: series.cast,
          director: series.director,
          genre: series.genre,
          releaseDate: String(series.releaseDate || ''),
          last_modified: String(Math.floor(new Date(series.last_modified).getTime() / 1000)),
          rating: series.rating,
          rating_5based: series.rating_5based,
          backdrop_path: series.backdrop_path || [],
          youtube_trailer: series.youtube_trailer,
          episode_run_time: series.episode_run_time,
          category_id: String(series.category_id)
        },
        episodes: seasons
      });
    }

    // ============= EPG =============
    case 'get_short_epg': {
      if (!stream_id) return res.status(400).json({ error: 'stream_id required' });
      const stream = await queryOne('SELECT epg_channel_id FROM streams WHERE id = ?', [parseInt(stream_id)]);
      if (!stream?.epg_channel_id) return res.json({ epg_listings: [] });

      const listings = await query(
        `SELECT title, description, start, end, channel_id, lang, category, episode_num, has_archive
         FROM epg_data
         WHERE channel_id = ? AND end >= NOW()
         ORDER BY start ASC LIMIT 10`,
        [stream.epg_channel_id]
      );

      return res.json({
        epg_listings: listings.map(e => ({
          id: String(Math.floor(new Date(e.start).getTime() / 1000)),
          epg_id: e.channel_id,
          title: Buffer.from(e.title).toString('base64'),
          lang: e.lang || 'en',
          start: e.start.toISOString().replace('T', ' ').replace('.000Z', ''),
          end: e.end.toISOString().replace('T', ' ').replace('.000Z', ''),
          description: Buffer.from(e.description || '').toString('base64'),
          channel_id: e.channel_id,
          start_timestamp: String(Math.floor(new Date(e.start).getTime() / 1000)),
          stop_timestamp: String(Math.floor(new Date(e.end).getTime() / 1000)),
          now_playing: 0,
          has_archive: e.has_archive ? 1 : 0
        }))
      });
    }

    case 'get_epg': {
      if (!stream_id) return res.status(400).json({ error: 'stream_id required' });
      const stream = await queryOne('SELECT epg_channel_id FROM streams WHERE id = ?', [parseInt(stream_id)]);
      if (!stream?.epg_channel_id) return res.json({ epg_listings: [] });

      const listings = await query(
        `SELECT title, description, start, end, channel_id, lang, category, episode_num, has_archive
         FROM epg_data
         WHERE channel_id = ? AND start >= DATE_SUB(NOW(), INTERVAL 3 DAY) AND start <= DATE_ADD(NOW(), INTERVAL 7 DAY)
         ORDER BY start ASC`,
        [stream.epg_channel_id]
      );

      return res.json({
        epg_listings: listings.map(e => ({
          id: String(Math.floor(new Date(e.start).getTime() / 1000)),
          epg_id: e.channel_id,
          title: Buffer.from(e.title).toString('base64'),
          lang: e.lang || 'en',
          start: e.start.toISOString().replace('T', ' ').replace('.000Z', ''),
          end: e.end.toISOString().replace('T', ' ').replace('.000Z', ''),
          description: Buffer.from(e.description || '').toString('base64'),
          channel_id: e.channel_id,
          start_timestamp: String(Math.floor(new Date(e.start).getTime() / 1000)),
          stop_timestamp: String(Math.floor(new Date(e.end).getTime() / 1000)),
          now_playing: 0,
          has_archive: e.has_archive ? 1 : 0
        }))
      });
    }

    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
});

// M3U Playlist generator: /get.php or /playlist.m3u
router.get(['/get.php', '/playlist.m3u'], xtreamLimiter, async (req, res) => {
  const { username, password, type, output } = req.query;

  const user = await authenticateXtream(username, password);
  if (!user) {
    return res.status(401).send('#EXTM3U\n# Authentication failed');
  }

  const serverInfo = await getServerInfo();
  const baseUrl = serverInfo.url;
  const outputExt = output === 'mpegts' ? 'ts' : 'm3u8';

  let lines = [`#EXTM3U url-tvg="${baseUrl}/xmltv.php?username=${username}&password=${password}" refresh="600"`];

  const contentType = type || 'all';

  // Live streams
  if (['all', 'live', 'm3u_plus'].includes(contentType)) {
    let where = ['s.is_active = 1', 's.stream_type = "live"'];
    const params = [];
    if (user.bouquet_id) {
      where.push('EXISTS (SELECT 1 FROM bouquet_streams bs WHERE bs.bouquet_id = ? AND bs.stream_id = s.id AND bs.stream_type = "live")');
      params.push(user.bouquet_id);
    }

    const streams = await query(
      `SELECT s.id, s.num, s.name, s.stream_icon, s.epg_channel_id,
              c.category_name, s.tv_archive, s.tv_archive_duration
       FROM streams s
       LEFT JOIN stream_categories c ON c.id = s.category_id
       WHERE ${where.join(' AND ')}
       ORDER BY s.num ASC`,
      params
    );

    for (const s of streams) {
      const tvgId = s.epg_channel_id || '';
      const groupTitle = s.category_name || 'General';
      const logo = s.stream_icon || '';
      const catchupDays = s.tv_archive ? (s.tv_archive_duration || 7) : 0;
      const catchupAttr = s.tv_archive ? ` catchup="default" catchup-days="${catchupDays}"` : '';

      lines.push(`#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${s.name}" tvg-logo="${logo}" group-title="${groupTitle}"${catchupAttr},${s.name}`);
      lines.push(`${baseUrl}/live/${username}/${password}/${s.id}.${outputExt}`);
    }
  }

  // VOD
  if (['all', 'vod'].includes(contentType)) {
    let where = ['v.is_active = 1'];
    const params = [];
    if (user.bouquet_id) {
      where.push('EXISTS (SELECT 1 FROM bouquet_streams bs WHERE bs.bouquet_id = ? AND bs.stream_id = v.id AND bs.stream_type = "vod")');
      params.push(user.bouquet_id);
    }

    const vods = await query(
      `SELECT v.id, v.vod_name, v.stream_icon, v.container_extension, v.genre, v.releaseDate,
              c.category_name
       FROM vod_streams v
       LEFT JOIN stream_categories c ON c.id = v.category_id
       WHERE ${where.join(' AND ')}
       ORDER BY v.added DESC LIMIT 5000`,
      params
    );

    for (const v of vods) {
      const groupTitle = v.category_name || 'VOD';
      const logo = v.stream_icon || '';
      lines.push(`#EXTINF:-1 tvg-name="${v.vod_name}" tvg-logo="${logo}" group-title="${groupTitle}",${v.vod_name}`);
      lines.push(`${baseUrl}/movie/${username}/${password}/${v.id}.${v.container_extension || 'mkv'}`);
    }
  }

  res.setHeader('Content-Type', 'application/x-mpegURL; charset=UTF-8');
  res.setHeader('Content-Disposition', `attachment; filename="playlist_${username}.m3u"`);
  res.send(lines.join('\n'));
});

// XMLTV EPG endpoint: /xmltv.php
router.get('/xmltv.php', xtreamLimiter, async (req, res) => {
  const { username, password } = req.query;
  const user = await authenticateXtream(username, password);
  if (!user) return res.status(401).send('<?xml version="1.0"?><tv></tv>');

  const cacheKey = `xmltv:${user.id}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    return res.send(cached);
  }

  const channels = await query(
    `SELECT DISTINCT s.epg_channel_id, s.name, s.stream_icon
     FROM streams s
     WHERE s.is_active = 1 AND s.epg_channel_id IS NOT NULL AND s.stream_type = 'live'`
  );

  const programmes = await query(
    `SELECT DISTINCT e.channel_id, e.title, e.description, e.start, e.end,
            e.category, e.episode_num, e.icon, e.lang
     FROM epg_data e
     WHERE e.channel_id IN (${channels.map(() => '?').join(',') || "''"})
       AND e.start >= DATE_SUB(NOW(), INTERVAL 1 DAY)
       AND e.start <= DATE_ADD(NOW(), INTERVAL 7 DAY)
     ORDER BY e.channel_id, e.start`,
    channels.map(c => c.epg_channel_id).filter(Boolean)
  );

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<!DOCTYPE tv SYSTEM "xmltv.dtd">\n';
  xml += `<tv source-info-name="IPTV Panel" generator-info-name="IPTVPanel/1.0">\n`;

  for (const ch of channels) {
    if (!ch.epg_channel_id) continue;
    xml += `  <channel id="${escapeXml(ch.epg_channel_id)}">\n`;
    xml += `    <display-name>${escapeXml(ch.name)}</display-name>\n`;
    if (ch.stream_icon) xml += `    <icon src="${escapeXml(ch.stream_icon)}"/>\n`;
    xml += `  </channel>\n`;
  }

  for (const p of programmes) {
    const start = formatXmltvDate(p.start);
    const stop = formatXmltvDate(p.end);
    xml += `  <programme start="${start}" stop="${stop}" channel="${escapeXml(p.channel_id)}">\n`;
    xml += `    <title lang="${p.lang || 'en'}">${escapeXml(p.title)}</title>\n`;
    if (p.description) xml += `    <desc lang="${p.lang || 'en'}">${escapeXml(p.description)}</desc>\n`;
    if (p.category) xml += `    <category lang="en">${escapeXml(p.category)}</category>\n`;
    if (p.episode_num) xml += `    <episode-num system="xmltv_ns">${escapeXml(p.episode_num)}</episode-num>\n`;
    if (p.icon) xml += `    <icon src="${escapeXml(p.icon)}"/>\n`;
    xml += `  </programme>\n`;
  }

  xml += '</tv>';

  await cache.set(cacheKey, xml, 3600);
  res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
  res.send(xml);
});

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatXmltvDate(date) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())} +0000`;
}

module.exports = router;
