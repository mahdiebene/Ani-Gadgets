function createRateLimiter({ windowMs = 60000, max = 100, maxEntries = 10000, now = Date.now } = {}) {
  const entries = new Map();
  const prune = () => {
    const time = now();
    for (const [ip, entry] of entries) if (entry.resetTime <= time) entries.delete(ip);
  };
  const timer = setInterval(prune, windowMs);
  timer.unref();
  const middleware = (req, res, next) => {
    const time = now();
    let entry = entries.get(req.ip);
    if (!entry || entry.resetTime <= time) {
      if (!entry && entries.size >= maxEntries) {
        prune();
        if (entries.size >= maxEntries) {
          res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
          return res.status(429).json({ error: 'Too many requests. Please slow down.' });
        }
      }
      entry = { count: 0, resetTime: time + windowMs };
      entries.set(req.ip, entry);
    }
    if (++entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetTime - time) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  };
  return { middleware, close: () => clearInterval(timer), prune, entries };
}
module.exports = { createRateLimiter };