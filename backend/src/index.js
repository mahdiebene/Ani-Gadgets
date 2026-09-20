require('dotenv').config();
const { createApp } = require('./app');
const { createPool } = require('./db/pool');
const { createRepository } = require('./db/repository');
const pool = createPool();
const db = createRepository(pool);
const { createCatalogueRepository } = require('./catalogue/repository');

const app = createApp({ db, catalogue: createCatalogueRepository(pool) });
if (require.main === module) {
  const port = process.env.PORT || 3001;
  const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`AnimeGadgetsHub API listening on port ${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
    app.locals.close();
    server.close(async () => { await pool.end(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
module.exports = app;