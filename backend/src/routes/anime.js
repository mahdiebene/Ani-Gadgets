const express = require('express');
const { asyncRoute, pagination, numberParam, httpError } = require('../utils/http');
const { matchAnime } = require('../ingest/animeMatcher');

module.exports = function animeRoutes(db) {
  const router = express.Router();
  router.get('/', asyncRoute(async (req, res) => {
    const { limit, offset } = pagination(req.query, 25);
    const data = await db.listAnime({ limit, offset });
    res.json({ success: true, data });
  }));
  async function findAnime(malId) {
    const id = numberParam(malId, undefined, { min: 1 });
    const anime = await db.getAnime(id);
    if (!anime) throw httpError(404, 'Anime not found');
    return anime;
  }
  router.get('/:malId/products', asyncRoute(async (req, res) => {
    const { limit, offset } = pagination(req.query);
    const anime = await findAnime(req.params.malId);
    const name = anime.anime_name || matchAnime(anime.title_english || anime.title)?.name || anime.title;
    const { products } = await db.listProducts({ anime: name, limit, offset });
    res.json({ success: true, data: products });
  }));
  router.get('/:malId', asyncRoute(async (req, res) => {
    res.json({ success: true, data: await findAnime(req.params.malId) });
  }));
  return router;
};