/**
 * Production M3U/M3U+ parser
 * Handles IPTV-specific extended M3U attributes
 */

const STREAM_TYPE_PATTERNS = {
  movie: /\.(mkv|mp4|avi|mov|flv|wmv|m4v)($|\?)/i,
  series: /[Ss]\d{1,3}[Ee]\d{1,3}/,
  live: null
};

function detectStreamType(url, groupTitle, title) {
  // Check URL extension for VOD
  if (url && STREAM_TYPE_PATTERNS.movie.test(url)) return 'vod';
  // Check for series pattern in title
  if (title && STREAM_TYPE_PATTERNS.series.test(title)) return 'series';
  // Check group hints
  if (groupTitle) {
    const g = groupTitle.toLowerCase();
    if (g.includes('movie') || g.includes('film') || g.includes('vod') || g.includes('cinema')) return 'vod';
    if (g.includes('series') || g.includes('serie') || g.includes('show') || g.includes('season')) return 'series';
  }
  return 'live';
}

function parseM3U(content) {
  const lines = content.split(/\r?\n/);
  const items = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTM3U')) {
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      current = parseExtInf(line);
      continue;
    }

    if (line.startsWith('#EXTVLCOPT') || line.startsWith('#KODIPROP')) {
      // Skip VLC/Kodi options but keep current
      continue;
    }

    if (line && !line.startsWith('#')) {
      // This is the URL line
      if (current) {
        current.url = line;
        current.stream_type = detectStreamType(line, current.group, current.name);

        if (current.name && current.url) {
          items.push(current);
        }
        current = null;
      }
    }
  }

  return items;
}

function parseExtInf(line) {
  const item = {
    name: '',
    duration: -1,
    tvg_id: null,
    tvg_name: null,
    tvg_logo: null,
    logo: null,
    group: null,
    url: null,
    stream_type: 'live'
  };

  // Extract duration
  const durationMatch = line.match(/^#EXTINF:(-?\d+)/);
  if (durationMatch) {
    item.duration = parseInt(durationMatch[1]);
  }

  // Extract attributes
  const attrPatterns = {
    tvg_id: /tvg-id="([^"]*)"/i,
    tvg_name: /tvg-name="([^"]*)"/i,
    tvg_logo: /tvg-logo="([^"]*)"/i,
    logo: /logo="([^"]*)"/i,
    group: /group-title="([^"]*)"/i,
    tvg_country: /tvg-country="([^"]*)"/i,
    tvg_language: /tvg-language="([^"]*)"/i,
    catchup: /catchup="([^"]*)"/i,
    catchup_days: /catchup-days="([^"]*)"/i
  };

  for (const [key, pattern] of Object.entries(attrPatterns)) {
    const match = line.match(pattern);
    if (match) item[key] = match[1].trim();
  }

  // Logo fallback
  if (!item.tvg_logo && item.logo) item.tvg_logo = item.logo;
  item.logo = item.tvg_logo;

  // Extract title (after the last comma)
  const commaIdx = line.lastIndexOf(',');
  if (commaIdx !== -1) {
    item.name = line.substring(commaIdx + 1).trim();
  }

  // Clean name
  if (item.name) {
    item.name = item.name
      .replace(/\s*\[.*?\]/g, '') // Remove [HD], [FHD] etc
      .replace(/\s*\(.*?\)/g, '') // Remove (1080p) etc if desired
      .trim();
    if (!item.name) item.name = item.tvg_name || 'Unknown';
  }

  return item;
}

/**
 * Generate M3U content from stream array
 */
function generateM3U(streams, baseUrl, username, password, outputExt = 'ts') {
  const lines = [`#EXTM3U url-tvg="${baseUrl}/xmltv.php?username=${username}&password=${password}" refresh="600"`];

  for (const s of streams) {
    const tvgId = s.epg_channel_id || s.tvg_id || '';
    const logo = s.stream_icon || s.logo || '';
    const group = s.category_name || s.group || 'General';
    const name = s.name || s.stream_display_name || 'Channel';
    const catchup = s.tv_archive ? ` catchup="default" catchup-days="${s.tv_archive_duration || 7}"` : '';

    lines.push(`#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}"${catchup},${name}`);

    let url;
    switch (s.stream_type || 'live') {
      case 'vod': url = `${baseUrl}/movie/${username}/${password}/${s.id}.${s.container_extension || 'mkv'}`; break;
      case 'series': url = `${baseUrl}/series/${username}/${password}/${s.id}.${s.container_extension || 'mkv'}`; break;
      default: url = `${baseUrl}/live/${username}/${password}/${s.id}.${outputExt}`;
    }
    lines.push(url);
  }

  return lines.join('\n');
}

module.exports = { parseM3U, generateM3U, parseExtInf };
