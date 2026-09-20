const express = require('express');
const { asyncRoute, pagination, numberParam, textParam, httpError } = require('../utils/http');

module.exports = function productRoutes(db) {
  const router = express.Router();
  // Aggregation happens in SQL, not a capped row fetch.
  for (const [path, key] of [['categories', 'categories'], ['anime', 'anime'], ['sources', 'sources']]) {
    router.get(`/meta/${path}`, asyncRoute(async (req, res) => {
      const metadata = await db.metadata();
      res.json({ success: true, data: metadata[key] });
    }));
  }
  router.get('/anime/:animeName', asyncRoute(async (req, res) => {
    const { limit } = pagination(req.query);
    const { products } = await db.listProducts({ anime: textParam(req.params.animeName), limit });
    res.json({ success: true, data: products });
  }));
  router.get('/', asyncRoute(async (req, res) => {
    const { limit, offset } = pagination(req.query, 50);
    const minScore = numberParam(req.query.minScore, 0, { max: 100, integer: false });
    const minPrice = numberParam(req.query.minPrice, undefined, { integer: false });
    const maxPrice = numberParam(req.query.maxPrice, undefined, { integer: false });
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw httpError(400, 'Minimum price must not exceed maximum price');
    }
    const category = textParam(req.query.category);
    const anime = textParam(req.query.anime);
    const source = textParam(req.query.source, 50);
    const search = textParam(req.query.search);
    const { products, total } = await db.listProducts({ limit, offset, minScore, minPrice, maxPrice,
      category, anime, source, search, scoredOnly: req.query.scoredOnly === 'true',
      sortBy: textParam(req.query.sortBy), sortOrder: textParam(req.query.sortOrder) });
    res.json({ success: true, data: products, pagination: { limit, offset, total } });
  }));
  router.get('/:id', asyncRoute(async (req, res) => {
    const id = numberParam(req.params.id, undefined, { min: 1 });
    const data = await db.getProduct(id);
    if (!data) throw httpError(404, 'Product not found');
    res.json({ success: true, data });
  }));
  return router;
};