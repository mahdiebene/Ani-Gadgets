const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productRoutes = require('./routes/products');
const animeRoutes = require('./routes/anime');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3001;

// Simple rate limiting (in-memory, for production use redis)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // max requests per window

const rateLimitMiddleware = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const record = rateLimit.get(ip);
  
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }
  
  record.count++;
  next();
};

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    // Allow any vercel.app subdomain or configured origins
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(rateLimitMiddleware);

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/products', productRoutes);
app.use('/api/anime', animeRoutes);
app.use('/api/stats', statsRoutes);

// Health check - for uptime monitoring (BetterStack, UptimeRobot, etc.)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AnimeGadgetsHub API'
  });
});

// Root endpoint - HTML page for monitoring
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AnimeGadgetsHub API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a; 
      color: #fff; 
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .status { 
      display: inline-block;
      background: #22c55e; 
      color: #000; 
      padding: 0.25rem 0.75rem; 
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
    }
    .version { color: #666; font-size: 0.875rem; margin-bottom: 2rem; }
    .endpoints { text-align: left; background: #111; padding: 1.5rem; max-width: 300px; margin: 0 auto; }
    .endpoints h3 { font-size: 0.75rem; color: #666; text-transform: uppercase; margin-bottom: 1rem; }
    .endpoints a { 
      display: block; 
      color: #3b82f6; 
      text-decoration: none; 
      padding: 0.5rem 0;
      border-bottom: 1px solid #222;
    }
    .endpoints a:hover { color: #60a5fa; }
    .endpoints a:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>AnimeGadgetsHub API</h1>
    <div class="status">● Online</div>
    <p class="version">v1.0.0</p>
    <div class="endpoints">
      <h3>Endpoints</h3>
      <a href="/api/products">/api/products</a>
      <a href="/api/anime">/api/anime</a>
      <a href="/api/stats">/api/stats</a>
      <a href="/health">/health</a>
    </div>
  </div>
</body>
</html>`;
  res.type('html').send(html);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 AnimeGadgetsHub API running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
