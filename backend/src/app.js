const express = require('express');
const cors = require('cors');
const productRoutes = require('./routes/products');
const animeRoutes = require('./routes/anime');
const statsRoutes = require('./routes/stats');
const { createRateLimiter } = require('./middleware/rateLimit');
const { httpError, HttpError } = require('./utils/http');

function createApp({ db, logger = console, rateLimitOptions } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Enable only behind one trusted proxy; the deployed API binds to localhost.
  app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
  const allowedOrigins = new Set([
    'http://localhost:3000', 'http://localhost:5173',
    'https://anigadgetsbd.app', 'https://www.anigadgetsbd.app', process.env.FRONTEND_URL
  ].filter(Boolean));
  app.use(cors({ origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(httpError(403, 'Origin not allowed'));
  } }));
  app.use(express.json({ limit: '16kb' }));
  const limiter = createRateLimiter(rateLimitOptions);
  app.locals.close = limiter.close;
  app.use('/api', limiter.middleware);
  app.use('/api/products', productRoutes(db));
  app.use('/api/anime', animeRoutes(db));
  app.use('/api/stats', statsRoutes(db));
  app.get('/health', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const newest = await db.lastUpdated();
      const stale = !newest || !Number.isFinite(Date.parse(newest)) || Date.now() - Date.parse(newest) > 12 * 60 * 60 * 1000;
      res.status(stale ? 503 : 200).json({
        status: stale ? 'degraded' : 'ok', database: 'ok',
        ingestion: { status: !newest ? 'empty' : stale ? 'stale' : 'ok', lastUpdated: newest }
      });
    } catch (error) {
      logger.error('Health database check failed:', error.code || 'database error');
      res.status(503).json({ status: 'error', database: 'unreachable' });
    }
  });
  app.get('/', (req, res) => res.json({ service: 'AnimeGadgetsHub API', health: '/health' }));
  app.use((req, res) => res.status(404).json({ success: false, error: 'Endpoint not found' }));
  app.use((error, req, res, next) => {
    logger.error(`${req.method} ${req.path}:`, error instanceof HttpError ? error.message : error.code || 'internal error');
    const status = error instanceof HttpError ? error.status : 500;
    res.status(status).json({ success: false, error: status === 500 ? 'Service temporarily unavailable. Please try again.' : error.message });
  });
  return app;
}
module.exports = { createApp };