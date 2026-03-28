const cron = require('node-cron');
const { query } = require('../config/database');
const { cache } = require('../config/redis');
const { refreshAllEpgSources } = require('../services/epgProcessor');
const { bulkCheckStreams } = require('../services/streamHealth');
const logger = require('../config/logger');

function startCronJobs() {
  // Clean stale active connections every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const cleaned = await cache.cleanStaleConnections(5 * 60 * 1000);
      if (cleaned > 0) logger.info(`Cleaned ${cleaned} stale connections`);
    } catch (err) {
      logger.error('Connection cleanup error', { err: err.message });
    }
  });

  // EPG refresh every 12 hours at 2:00 AM and 2:00 PM
  cron.schedule('0 2,14 * * *', async () => {
    logger.info('Starting scheduled EPG refresh');
    try {
      const result = await refreshAllEpgSources();
      logger.info('EPG refresh completed', result);
    } catch (err) {
      logger.error('Scheduled EPG refresh failed', { err: err.message });
    }
  });

  // Stream health check every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      const streams = await query(
        'SELECT id, name, direct_source FROM streams WHERE is_active = 1 AND stream_type = "live" ORDER BY RAND() LIMIT 50'
      );
      if (!streams.length) return;

      const results = await bulkCheckStreams(streams, 10);
      for (const r of results) {
        await query(
          'UPDATE streams SET stream_status = ?, last_status_check = NOW() WHERE id = ?',
          [r.online ? 'online' : 'offline', r.id]
        );
      }

      await cache.delPattern('streams:list:*');
    } catch (err) {
      logger.error('Stream health check error', { err: err.message });
    }
  });

  // Clean expired EPG data (older than 7 days) - daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await query(
        'DELETE FROM epg_data WHERE end < DATE_SUB(NOW(), INTERVAL 7 DAY)'
      );
      logger.info('EPG cleanup', { deleted: result.affectedRows || 0 });
    } catch (err) {
      logger.error('EPG cleanup error', { err: err.message });
    }
  });

  // Clean old connection logs (older than 30 days) - weekly Sunday 4 AM
  cron.schedule('0 4 * * 0', async () => {
    try {
      const result = await query(
        'DELETE FROM connection_logs WHERE connected_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
      );
      logger.info('Connection log cleanup', { deleted: result.affectedRows || 0 });
    } catch (err) {
      logger.error('Log cleanup error', { err: err.message });
    }
  });

  // Update server stats every minute
  cron.schedule('* * * * *', async () => {
    try {
      const servers = await query('SELECT id FROM servers WHERE status = "online"');
      // In a real setup, this would SSH/API call each server for stats
      // For now, update timestamp
      if (servers.length > 0) {
        await query('UPDATE servers SET last_ping = NOW() WHERE status = "online"');
      }
    } catch (err) {
      logger.error('Server stats update error', { err: err.message });
    }
  });

  // Expire subscriptions and update user status
  cron.schedule('0 * * * *', async () => {
    try {
      await query(`
        UPDATE subscriptions
        SET status = 'expired'
        WHERE status = 'active'
          AND end_date IS NOT NULL
          AND end_date < NOW()
      `);
    } catch (err) {
      logger.error('Subscription expiry job error', { err: err.message });
    }
  });

  logger.info('Cron jobs started');
}

module.exports = { startCronJobs };
