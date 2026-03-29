/**
 * Security hardening middleware
 * - Detectare device tip (mobile/desktop/smart-tv/mag)
 * - Anti-scan: blochează tool-uri de scanare (nmap, nikto, etc.)
 * - Request fingerprinting
 * - Suspicous user-agent detection
 */

const logger = require('../config/logger');
const { redis } = require('../config/redis');

const SCANNER_SIGNATURES = [
  /nmap/i, /nikto/i, /masscan/i, /dirbuster/i, /sqlmap/i,
  /hydra/i, /burpsuite/i, /owasp/i, /acunetix/i, /nessus/i,
  /openvas/i, /metasploit/i, /w3af/i, /havij/i, /zgrab/i,
  /python-requests\/\d+\.\d+\.\d+$/i, /go-http-client/i,
  /curl\/\d/i, /wget\/\d/i
];

// Detectare tip dispozitiv din User-Agent
function detectDeviceType(userAgent) {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();

  // Smart TV / STB
  if (/tivimate|gse|smart iptv|iptv smarters|ottplayer|nplayer|vlc|kodi|enigma|dreambox|zgemma|mag\d|formuler|android tv|googletv|apple tv|firetv|fire_tv|webos|tizen|viera|bravia/i.test(ua)) {
    return 'stb';
  }
  // Mobile
  if (/android.*mobile|iphone|ipod|blackberry|windows phone|opera mini|mobile safari/i.test(ua)) {
    return 'mobile';
  }
  // Tablet
  if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) {
    return 'tablet';
  }
  // Desktop
  if (/windows|macintosh|linux x86|x11/i.test(ua)) {
    return 'desktop';
  }
  return 'other';
}

// Middleware anti-scan
async function antiScan(req, res, next) {
  const ua = req.headers['user-agent'] || '';
  const ip = (req.ip || '').replace('::ffff:', '');

  // Nu bloca IP-uri interne (Docker, localhost, rețele private)
  const isInternal = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$)/.test(ip);
  if (isInternal) return next();

  // Blochează scanner-e cunoscute
  if (SCANNER_SIGNATURES.some(sig => sig.test(ua))) {
    const scanKey = `scan:${ip}`;
    const count = await redis.incr(scanKey);
    if (count === 1) await redis.expire(scanKey, 3600);

    logger.warn('Scanner detected and blocked', { ip, ua: ua.substring(0, 100) });
    // Răspunde cu 200 gol pentru a nu da hint că e blocat
    return res.status(200).send('');
  }

  // Detectează path traversal și alte atacuri comune
  const url = req.url;
  if (
    url.includes('../') ||
    url.includes('..%2F') ||
    url.includes('%00') ||
    url.includes('<script') ||
    /union.*select/i.test(url) ||
    /(\bor\b|\band\b)\s+\d+=\d+/i.test(url)
  ) {
    const attackKey = `attack:${ip}`;
    const count = await redis.incr(attackKey);
    if (count === 1) await redis.expire(attackKey, 86400);

    if (count >= 3) {
      logger.warn('Attack pattern detected, blocking IP', { ip, url: url.substring(0, 200) });
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    return res.status(400).json({ success: false, message: 'Bad request' });
  }

  next();
}

// Middleware detectare device (adaugă req.deviceType)
function deviceDetect(req, res, next) {
  req.deviceType = detectDeviceType(req.headers['user-agent']);
  next();
}

// Middleware security headers suplimentare
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // Ascunde stack fingerprint
  res.removeHeader('X-Powered-By');
  next();
}

module.exports = { antiScan, deviceDetect, securityHeaders, detectDeviceType };
