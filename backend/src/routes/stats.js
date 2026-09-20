const express = require('express');
const { asyncRoute } = require('../utils/http');
const { DISPLAY_MIN_SCORE } = require('../services/intelligentScorerService');

module.exports = function statsRoutes(db) {
  const router = express.Router();
  router.get('/', asyncRoute(async (req, res) => {
    const data = await db.stats(DISPLAY_MIN_SCORE);
    res.json({ success: true, data });
  }));
  return router;
};