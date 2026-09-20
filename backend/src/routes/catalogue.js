const { Router } = require('express');
const { asyncRoute, httpError, numberParam, pagination, textParam } = require('../utils/http');
const { compareOffers } = require('../catalogue/comparison');
const { safeUrl } = require('../catalogue/validation');

module.exports = function catalogueRoutes(db) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!db) return next(httpError(503, 'Catalogue is not enabled yet'));
    next();
  });
  router.get('/', asyncRoute(async (req, res) => {
    const page = pagination(req.query);
    const result = await db.list({ ...page, search: textParam(req.query.search), category: textParam(req.query.category) });
    res.json({ success: true, data: result.products, pagination: { ...page, total: result.total } });
  }));
  router.get('/:id', asyncRoute(async (req, res) => {
    const id = numberParam(req.params.id, undefined, { min: 1, max: 2147483647 });
    const data = await db.detail(id);
    if (!data) throw httpError(404, 'Catalogue product not found');
    data.offers = compareOffers(data.offers).map(offer => {
      for (const key of ['payment_policy_url', 'delivery_policy_url', 'return_policy_url']) if (!safeUrl(offer[key])) offer[key] = null;
      return offer;
    });
    data.evidence = data.evidence.filter(row => safeUrl(row.source_url));
    if (!safeUrl(data.product.identity_reference_url)) data.product.identity_reference_url = null;
    res.json({ success: true, data });
  }));
  return router;
};