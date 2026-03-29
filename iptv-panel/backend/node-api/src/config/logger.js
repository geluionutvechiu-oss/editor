const winston = require('winston');
const path = require('path');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'iptv-api' },
  transports: [
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || '/var/log/iptv', 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || '/var/log/iptv', 'combined.log'),
      maxsize: 20 * 1024 * 1024,
      maxFiles: 10,
      tailable: true
    })
  ]
});

// Scrie intotdeauna in consolă (necesar pentru docker logs)
logger.add(new winston.transports.Console({
  format: process.env.NODE_ENV !== 'production'
    ? combine(colorize(), simple())
    : combine(timestamp({ format: 'HH:mm:ss' }), simple())
}));

module.exports = logger;
