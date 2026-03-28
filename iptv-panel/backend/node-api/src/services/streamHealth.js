const axios = require('axios');
const logger = require('../config/logger');

/**
 * Check if a stream URL is accessible
 * Supports HLS, HTTP TS, RTMP detection
 */
async function checkStreamHealth(url, timeoutMs = 8000) {
  if (!url) {
    return { online: false, latency: null, error: 'No URL provided', http_code: null };
  }

  const start = Date.now();

  // RTMP streams - can't HEAD/GET easily, return unknown
  if (url.startsWith('rtmp://') || url.startsWith('rtmps://')) {
    return { online: true, latency: null, protocol: 'rtmp', note: 'RTMP - not HTTP checkable' };
  }

  try {
    const response = await axios({
      method: 'GET',
      url,
      timeout: timeoutMs,
      responseType: 'stream',
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        'Range': 'bytes=0-8191' // Only fetch first 8KB
      },
      maxContentLength: 512 * 1024, // 512KB max
      validateStatus: (status) => status < 500
    });

    const latency = Date.now() - start;

    // Destroy stream immediately after getting headers
    response.data.destroy();

    const contentType = response.headers['content-type'] || '';
    const isVideoContent = (
      contentType.includes('video') ||
      contentType.includes('audio') ||
      contentType.includes('application/x-mpegURL') ||
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('application/dash+xml')
    );

    const online = response.status >= 200 && response.status < 300 && (isVideoContent || response.status === 206);

    return {
      online,
      latency,
      http_code: response.status,
      content_type: contentType,
      protocol: url.startsWith('https') ? 'https' : 'http'
    };
  } catch (err) {
    const latency = Date.now() - start;

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return { online: false, latency, error: 'Timeout', http_code: null };
    }

    if (err.response) {
      return {
        online: err.response.status >= 200 && err.response.status < 300,
        latency,
        http_code: err.response.status,
        error: `HTTP ${err.response.status}`
      };
    }

    logger.debug('Stream health check failed', { url: url.substring(0, 100), err: err.message });
    return { online: false, latency, error: err.message, http_code: null };
  }
}

/**
 * Ping a server by domain/IP
 */
async function pingServer(host, port = 80) {
  const start = Date.now();
  try {
    await axios.get(`http://${host}:${port}/`, {
      timeout: 5000,
      validateStatus: () => true
    });
    return { reachable: true, latency: Date.now() - start };
  } catch {
    return { reachable: false, latency: Date.now() - start };
  }
}

/**
 * Bulk health check with concurrency control
 */
async function bulkCheckStreams(streams, concurrency = 10) {
  const results = [];
  const semaphore = { count: 0 };

  const check = async (stream) => {
    while (semaphore.count >= concurrency) {
      await new Promise(r => setTimeout(r, 100));
    }
    semaphore.count++;
    try {
      const result = await checkStreamHealth(stream.direct_source || stream.url);
      return { id: stream.id, ...result };
    } finally {
      semaphore.count--;
    }
  };

  const promises = streams.map(s => check(s));
  const settled = await Promise.allSettled(promises);

  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(r.value);
    else results.push({ online: false, error: r.reason?.message });
  }

  return results;
}

module.exports = { checkStreamHealth, pingServer, bulkCheckStreams };
