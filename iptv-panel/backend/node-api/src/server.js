require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const logger = require('./config/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { ipFilter } = require('./middleware/ipFilter');
const { antiScan, deviceDetect, securityHeaders } = require('./middleware/security');
const { setupWebSocket } = require('./websocket/statsServer');
const { startCronJobs } = require('./utils/cronJobs');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const streamRoutes = require('./routes/streams');
const vodRoutes = require('./routes/vod');
const seriesRoutes = require('./routes/series');
const epgRoutes = require('./routes/epg');
const adminRoutes = require('./routes/admin');
const xtreamRoutes = require('./routes/xtream');

const app = express();
const server = http.createServer(app);

// Trust proxy (for nginx/load balancer)
app.set('trust proxy', 1);

// Security
app.use(helmet({
  contentSecurityPolicy: false, // Handled by nginx
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.url === '/health'
}));

// Security hardening
app.use(securityHeaders);
app.use(antiScan);
app.use(deviceDetect);

// IP filter (applied to all routes)
app.use(ipFilter);

// Health check (no auth, no rate limit)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Xtream Codes API (no /api prefix — direct compatibility)
app.use('/', xtreamRoutes);

// REST API routes
app.use('/api/auth', apiLimiter, authRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/streams', apiLimiter, streamRoutes);
app.use('/api/vod', apiLimiter, vodRoutes);
app.use('/api/series', apiLimiter, seriesRoutes);
app.use('/api/epg', apiLimiter, epgRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);

// Stream proxy endpoint cu detecție device (v2)
app.get([
  '/live/:username/:password/:streamId',
  '/movie/:username/:password/:streamId',
  '/series/:username/:password/:streamId'
], require('./routes/streamProxyV2'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    err: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    url: req.url,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// WebSocket
const { broadcastToAdmins } = setupWebSocket(server);
app.set('broadcastToAdmins', broadcastToAdmins);

// Start cron jobs
startCronJobs();

const PORT = parseInt(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info(`IPTV API Server running on ${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

module.exports = { app, server };
