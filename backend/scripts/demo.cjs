// Offline, loopback-only demonstration. No database, images, fetches or real listings.
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { createApp } = require('../src/app');
const { createDemo } = require('../src/catalogue/demo');

async function main() {
  const dist = path.resolve(__dirname, '../../frontend/dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Build the frontend first: npm --prefix E:\\ani-gadgets\\frontend run build');
  const doc = createDemo();
  const products = doc.products.map(({ key, reviewed, published, ...product }, index) => ({ ...product, id: index + 1 }));
  const catalogue = {
    async list({ search = '', category = '', limit, offset }) {
      const matches = products.filter(p => (!category || p.category === category) && `${p.name} ${p.manufacturer_code}`.toLowerCase().includes(search.toLowerCase()));
      return { products: matches.slice(offset, offset + limit), total: matches.length };
    },
    async detail(id) {
      const product = products.find(p => p.id === id);
      if (!product) return null;
      const key = doc.products[id - 1].key;
      const offers = doc.offers.filter(o => o.product === key).map((row, index) => {
        const { offer, source_reference, ...observation } = doc.observations.find(n => n.offer === row.key);
        return { id: id * 2 + index, catalogue_product_id: id, listing_url: row.listing_url,
          condition: row.condition, included_parts: row.included_parts, purchase_route: row.purchase_route,
          merchant_name: doc.merchants.find(m => m.key === row.merchant).name, ...observation };
      });
      return { product, offers, history: offers.map(o => ({ ...o, offer_id: o.id })),
        evidence: doc.evidence.filter(e => e.product === key).map(({ key, product, reviewed, ...row }) => ({ ...row, catalogue_product_id: id })) };
    }
  };
  const api = createApp({ catalogue, db: {
    metadata: async () => ({ categories: [], anime: [], sources: [] }),
    stats: async () => ({ totalProducts: 0, totalAnime: 0, currency: 'BDT' }),
    listProducts: async () => ({ products: [], total: 0 }), getProduct: async () => null,
    listAnime: async () => [], getAnime: async () => null, lastUpdated: async () => null
  } });
  const app = express();
  app.use((req, res, next) => {
    // Even a mistakenly production-configured frontend build cannot call remote APIs.
    res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'");
    next();
  });
  app.use(express.static(dist)); app.use(api);
  const check = process.argv.includes('--check');
  const port = check ? 0 : Number(process.env.DEMO_PORT || 4173);
  const server = app.listen(port, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  if (check) {
    try {
      const response = await fetch(`${base}/api/catalogue`); const data = await response.json();
      if (!response.ok || data.pagination.total !== 100) throw new Error('Demo catalogue check failed');
      const detail = await (await fetch(`${base}/api/catalogue/1`)).json();
      if (!detail.data.offers[0].lowest_complete_total) throw new Error('Demo comparison check failed');
      if (!(await fetch(base)).ok) throw new Error('Frontend build was not served');
      console.log('Offline demo check passed: 100 identities, comparison API and built frontend; loopback only.');
    } finally { api.locals.close(); await new Promise(resolve => server.close(resolve)); }
  } else {
    console.log(`Fictional offline demo: ${base}/#catalogue — no database or real inventory. Ctrl+C to stop.`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { api.locals.close(); server.close(() => process.exit(0)); });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });