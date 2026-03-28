const rateLimit = require('express-rate-limit');
const { redis } = require('../config/redis');

// Redis store for rate limiting
class RedisStore {
  constructor(prefix = 'rl:', windowMs) {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  async increment(key) {
    const redisKey = `${this.prefix}${key}`;
    const multi = redis.multi();
    multi.incr(redisKey);
    multi.pttl(redisKey);
    const results = await multi.exec();
    const totalHits = results[0][1];
    const ttl = results[1][1];

    if (ttl === -1) {
      await redis.pexpire(redisKey, this.windowMs);
    }

    const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));
    return { totalHits, resetTime };
  }

  async decrement(key) {
    const redisKey = `${this.prefix}${key}`;
    await redis.decr(redisKey);
  }

  async resetKey(key) {
    const redisKey = `${this.prefix}${key}`;
    await redis.del(redisKey);
  }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('rl:auth:', 15 * 60 * 1000),
  message: { success: false, message: 'Too many login attempts, please try again later' },
  skipSuccessfulRequests: true
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('rl:api:', 60 * 1000),
  message: { success: false, message: 'Rate limit exceeded' }
});

const xtreamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  store: new RedisStore('rl:xtream:', 60 * 1000),
  message: { success: false, message: 'Rate limit exceeded' }
});

module.exports = { authLimiter, apiLimiter, xtreamLimiter };
