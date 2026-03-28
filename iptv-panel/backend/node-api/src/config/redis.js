const Redis = require('ioredis');
const logger = require('./logger');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    return targetErrors.some(e => err.message.includes(e));
  },
  lazyConnect: false,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err.message));
redis.on('close', () => logger.warn('Redis connection closed'));

// Cache helpers with namespacing
const cache = {
  async get(key) {
    const val = await redis.get(key);
    if (val === null) return null;
    try { return JSON.parse(val); } catch { return val; }
  },

  async set(key, value, ttlSeconds = 3600) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds > 0) {
      return redis.setex(key, ttlSeconds, serialized);
    }
    return redis.set(key, serialized);
  },

  async del(key) {
    return redis.del(key);
  },

  async delPattern(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return redis.del(...keys);
  },

  async incr(key, ttlSeconds = 0) {
    const val = await redis.incr(key);
    if (ttlSeconds > 0 && val === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return val;
  },

  async hset(key, field, value, ttlSeconds = 0) {
    await redis.hset(key, field, typeof value === 'string' ? value : JSON.stringify(value));
    if (ttlSeconds > 0) await redis.expire(key, ttlSeconds);
  },

  async hget(key, field) {
    const val = await redis.hget(key, field);
    if (val === null) return null;
    try { return JSON.parse(val); } catch { return val; }
  },

  async hgetall(key) {
    const data = await redis.hgetall(key);
    if (!data) return null;
    const result = {};
    for (const [k, v] of Object.entries(data)) {
      try { result[k] = JSON.parse(v); } catch { result[k] = v; }
    }
    return result;
  },

  async hdel(key, ...fields) {
    return redis.hdel(key, ...fields);
  },

  async sadd(key, ...members) {
    return redis.sadd(key, ...members);
  },

  async srem(key, ...members) {
    return redis.srem(key, ...members);
  },

  async smembers(key) {
    return redis.smembers(key);
  },

  async scard(key) {
    return redis.scard(key);
  },

  async ttl(key) {
    return redis.ttl(key);
  },

  // Active connections management
  async addActiveConnection(userId, sessionToken, data) {
    const key = `connections:user:${userId}`;
    await redis.hset(key, sessionToken, JSON.stringify({
      ...data,
      connectedAt: Date.now()
    }));
    await redis.set(`session:${sessionToken}`, userId, 'EX', 86400);
  },

  async removeActiveConnection(userId, sessionToken) {
    await redis.hdel(`connections:user:${userId}`, sessionToken);
    await redis.del(`session:${sessionToken}`);
  },

  async getUserConnectionCount(userId) {
    return redis.hlen(`connections:user:${userId}`);
  },

  async getUserConnections(userId) {
    const data = await redis.hgetall(`connections:user:${userId}`);
    if (!data) return [];
    return Object.entries(data).map(([token, val]) => {
      try { return { token, ...JSON.parse(val) }; }
      catch { return { token }; }
    });
  },

  async cleanStaleConnections(maxAgeMs = 5 * 60 * 1000) {
    const pattern = 'connections:user:*';
    const keys = await redis.keys(pattern);
    let cleaned = 0;
    for (const key of keys) {
      const connections = await redis.hgetall(key);
      if (!connections) continue;
      for (const [token, val] of Object.entries(connections)) {
        try {
          const conn = JSON.parse(val);
          if (Date.now() - conn.lastHeartbeat > maxAgeMs) {
            await redis.hdel(key, token);
            await redis.del(`session:${token}`);
            cleaned++;
          }
        } catch {
          await redis.hdel(key, token);
          cleaned++;
        }
      }
    }
    return cleaned;
  }
};

module.exports = { redis, cache };
