import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import { setupSocket } from './socket/index';
import authRoutes from './routes/auth';
import xtreamRoutes from './routes/xtream';
import { startJobs } from './jobs/index';
import userRoutes from './routes/users';
import clientRoutes from './routes/clients';
import planRoutes from './routes/plans';
import serverRoutes from './routes/servers';
import invoiceRoutes from './routes/invoices';
import resellerRoutes from './routes/resellers';
import notificationRoutes from './routes/notifications';
import securityRoutes from './routes/security';
import settingsRoutes from './routes/settings';
import dashboardRoutes from './routes/dashboard';
import streamsRouter from './routes/streams';
import moviesRouter from './routes/movies';
import seriesRouter from './routes/series';
import radioRouter from './routes/radio';
import categoriesRouter from './routes/categories';
import epgRouter from './routes/epg';
import connectionsRouter from './routes/connections';
import transcodingRouter from './routes/transcoding';
import devicesRouter from './routes/devices';
import ticketsRouter from './routes/tickets';
import creditsRouter from './routes/credits';
import { ipBlockMiddleware } from './middleware/ipBlock';
import logger from './lib/logger';
import prisma from './lib/prisma';

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

setupSocket(io);
export { io };

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// IP block check
app.use(ipBlockMiddleware);

// General rate limit
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Strict rate limit for login
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, try again later' },
  skipSuccessfulRequests: true,
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/resellers', resellerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/streams', streamsRouter);
app.use('/api/movies', moviesRouter);
app.use('/api/series', seriesRouter);
app.use('/api/radio', radioRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/epg', epgRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/transcoding', transcodingRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/credits', creditsRouter);

// Xtream Codes API compatibility (no /api prefix — direct URLs)
app.use('/', xtreamRoutes);

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  // Start background job queues
  if (process.env.DISABLE_JOBS !== 'true') {
    startJobs();
  }
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down...');
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
