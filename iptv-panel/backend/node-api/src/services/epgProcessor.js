const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const { query, queryOne, transaction } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../config/logger');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['programme', 'channel', 'display-name', 'category', 'desc', 'title', 'icon', 'episode-num'].includes(name),
  trimValues: true,
  parseAttributeValue: false
});

async function refreshEpgSource(source) {
  logger.info('EPG refresh started', { sourceId: source.id, url: source.url });

  let xmlContent;
  try {
    const response = await axios.get(source.url, {
      timeout: 120000,
      maxContentLength: 200 * 1024 * 1024, // 200MB max
      responseType: 'text',
      headers: {
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (compatible; IPTVPanel/1.0)'
      },
      decompress: true
    });
    xmlContent = response.data;
  } catch (err) {
    logger.error('EPG download failed', { sourceId: source.id, err: err.message });
    throw err;
  }

  let parsed;
  try {
    parsed = xmlParser.parse(xmlContent);
  } catch (err) {
    logger.error('EPG XML parse failed', { sourceId: source.id, err: err.message });
    throw new Error(`XML parse error: ${err.message}`);
  }

  const tv = parsed.tv || parsed.TV || {};
  const channels = Array.isArray(tv.channel) ? tv.channel : (tv.channel ? [tv.channel] : []);
  const programmes = Array.isArray(tv.programme) ? tv.programme : (tv.programme ? [tv.programme] : []);

  logger.info('EPG parsed', { sourceId: source.id, channels: channels.length, programmes: programmes.length });

  await transaction(async (conn) => {
    // Clear old data for this source
    await conn.execute('DELETE FROM epg_channels WHERE source_id = ?', [source.id]);
    await conn.execute('DELETE FROM epg_data WHERE source_id = ?', [source.id]);

    // Insert channels
    const channelBatch = [];
    for (const ch of channels) {
      const channelId = ch['@_id'];
      if (!channelId) continue;

      let displayName = '';
      if (Array.isArray(ch['display-name'])) {
        displayName = ch['display-name'][0]?.['#text'] || ch['display-name'][0] || '';
      } else if (ch['display-name']) {
        displayName = ch['display-name']['#text'] || ch['display-name'] || '';
      }

      let icon = null;
      if (ch.icon) {
        const iconEntry = Array.isArray(ch.icon) ? ch.icon[0] : ch.icon;
        icon = iconEntry?.['@_src'] || null;
      }

      channelBatch.push([source.id, channelId.substring(0, 255), displayName.substring(0, 255), icon?.substring(0, 999) || null]);
    }

    // Batch insert channels
    const chanBatchSize = 500;
    for (let i = 0; i < channelBatch.length; i += chanBatchSize) {
      const batch = channelBatch.slice(i, i + chanBatchSize);
      if (batch.length > 0) {
        const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
        await conn.execute(
          `INSERT IGNORE INTO epg_channels (source_id, channel_id, display_name, icon) VALUES ${placeholders}`,
          batch.flat()
        );
      }
    }

    // Insert programmes in batches
    const batchSize = 1000;
    let epgBatch = [];

    for (const prog of programmes) {
      const channelId = prog['@_channel'];
      const startStr = prog['@_start'];
      const stopStr = prog['@_stop'];

      if (!channelId || !startStr || !stopStr) continue;

      const start = parseXmltvDate(startStr);
      const end = parseXmltvDate(stopStr);
      if (!start || !end) continue;

      // Skip very old or very far future
      const now = Date.now();
      if (end < now - 7 * 24 * 3600 * 1000) continue;
      if (start > now + 14 * 24 * 3600 * 1000) continue;

      let title = '';
      if (Array.isArray(prog.title)) {
        title = prog.title[0]?.['#text'] || prog.title[0] || '';
      } else if (prog.title) {
        title = prog.title?.['#text'] || prog.title || '';
      }

      let desc = '';
      if (Array.isArray(prog.desc)) {
        desc = prog.desc[0]?.['#text'] || prog.desc[0] || '';
      } else if (prog.desc) {
        desc = prog.desc?.['#text'] || prog.desc || '';
      }

      let lang = 'en';
      if (Array.isArray(prog.title) && prog.title[0]?.['@_lang']) {
        lang = prog.title[0]['@_lang'];
      }

      let category = null;
      if (Array.isArray(prog.category)) {
        category = prog.category[0]?.['#text'] || prog.category[0] || null;
      } else if (prog.category) {
        category = prog.category?.['#text'] || prog.category || null;
      }

      let episodeNum = null;
      if (Array.isArray(prog['episode-num'])) {
        const xmltvNs = prog['episode-num'].find(e => e['@_system'] === 'xmltv_ns');
        if (xmltvNs) episodeNum = xmltvNs['#text'] || null;
        else episodeNum = prog['episode-num'][0]?.['#text'] || null;
      }

      let icon = null;
      if (prog.icon) {
        const iconEntry = Array.isArray(prog.icon) ? prog.icon[0] : prog.icon;
        icon = iconEntry?.['@_src'] || null;
      }

      const startDate = new Date(start).toISOString().replace('T', ' ').substring(0, 19);
      const endDate = new Date(end).toISOString().replace('T', ' ').substring(0, 19);
      const epgId = `${channelId}_${startStr}`;

      epgBatch.push([
        channelId.substring(0, 255),
        epgId.substring(0, 255),
        startDate, endDate,
        (title || 'Unknown').substring(0, 499),
        lang.substring(0, 10),
        (desc || null)?.substring(0, 65535),
        icon?.substring(0, 999) || null,
        (category || null)?.substring(0, 255),
        (episodeNum || null)?.substring(0, 100),
        source.id
      ]);

      if (epgBatch.length >= batchSize) {
        const placeholders = epgBatch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        await conn.execute(
          `INSERT IGNORE INTO epg_data (channel_id, epg_id, start, end, title, lang, description, icon, category, episode_num, source_id)
           VALUES ${placeholders}`,
          epgBatch.flat()
        );
        epgBatch = [];
      }
    }

    // Insert remaining
    if (epgBatch.length > 0) {
      const placeholders = epgBatch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      await conn.execute(
        `INSERT IGNORE INTO epg_data (channel_id, epg_id, start, end, title, lang, description, icon, category, episode_num, source_id)
         VALUES ${placeholders}`,
        epgBatch.flat()
      );
    }

    // Update source stats
    await conn.execute(
      'UPDATE epg_sources SET last_updated = NOW(), channel_count = ?, event_count = ? WHERE id = ?',
      [channelBatch.length, programmes.length, source.id]
    );
  });

  // Clear EPG cache
  await cache.delPattern('xmltv:*');
  await cache.delPattern('epg:*');

  logger.info('EPG refresh complete', {
    sourceId: source.id,
    channels: channels.length,
    programmes: programmes.length
  });

  return { channels: channels.length, programmes: programmes.length };
}

function parseXmltvDate(dateStr) {
  if (!dateStr) return null;

  // Format: 20231225183000 +0000 or 20231225183000 +0100
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
  if (!match) return null;

  const [, year, month, day, hour, min, sec, tz] = match;
  const isoStr = `${year}-${month}-${day}T${hour}:${min}:${sec}${tz ? formatTz(tz) : '+00:00'}`;

  const date = new Date(isoStr);
  return isNaN(date.getTime()) ? null : date.getTime();
}

function formatTz(tz) {
  // +0100 -> +01:00
  return `${tz.substring(0, 3)}:${tz.substring(3)}`;
}

async function refreshAllEpgSources() {
  const sources = await query('SELECT * FROM epg_sources WHERE is_active = 1');
  let total = { channels: 0, programmes: 0 };

  for (const source of sources) {
    try {
      const result = await refreshEpgSource(source);
      total.channels += result.channels;
      total.programmes += result.programmes;
    } catch (err) {
      logger.error('EPG source refresh failed', { sourceId: source.id, err: err.message });
    }
  }

  return total;
}

module.exports = { refreshEpgSource, refreshAllEpgSources, parseXmltvDate };
