const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPool } = require('../src/db/pool');
const { createRepository } = require('../src/db/repository');
const { normalizeItem } = require('../src/ingest/normalize');
const { listing } = require('./helpers');

test('real PostgreSQL: >1000 rows, search, pagination, permissions and rollback', { skip: process.env.TEST_DATABASE !== '1' }, async () => {
  const pool = createPool();
  const client = await pool.connect();
  const prefix = `integration-${Date.now()}`;
  try {
    await client.query('BEGIN');
    const db = createRepository(client);
    const rows = Array.from({ length: 1105 }, (_, index) => ({
      ...normalizeItem(listing({ itemId: String(9000000 + index),
        itemUrl: `https://www.daraz.com.bd/products/${prefix}-${index}.html` }), prefix),
      category: prefix, intelligent_score: 60, first_seen_at: '2020-01-01T00:00:00Z'
    }));
    for (let offset = 0; offset < rows.length; offset += 100) await db.upsertProducts(rows.slice(offset, offset + 100));
    const first = await db.listProducts({ category: prefix, limit: 20 });
    const second = await db.listProducts({ category: prefix, limit: 20, offset: 20 });
    assert.equal(first.total, 1105);
    assert.equal(second.total, 1105);
    assert.equal(first.products.length, 20);
    assert.equal(first.products.some(a => second.products.some(b => a.id === b.id)), false);
    assert.equal(typeof first.products[0].price, 'number');
    const beyond = await db.listProducts({ category: prefix, offset: 2000 });
    assert.equal(beyond.total, 1105);
    assert.equal(beyond.products.length, 0);
    assert.ok((await db.metadata()).categories.includes(prefix));
    assert.ok((await db.metadata()).sources.includes('daraz'));
    assert.equal((await db.listProducts({ category: prefix, source: 'daraz' })).total, 1105);
    assert.equal((await db.listProducts({ category: prefix, source: 'not-a-source' })).total, 0);
    assert.ok((await db.stats(45)).trendingProducts >= 1105);
    assert.equal((await db.listProducts({ category: prefix, search: 'Naruto, (figure)' })).total, 1105);
    assert.equal((await db.listProducts({ category: prefix, search: "x'); DROP TABLE products; --" })).total, 0);
    assert.equal(await db.getProduct(2147483647), null);
    await db.upsertProducts([{ ...rows[0], price: 999, first_seen_at: new Date().toISOString() }]);
    const existing = await db.findExisting([rows[0].product_url]);
    assert.equal(existing[0].first_seen_at.toISOString(), '2020-01-01T00:00:00.000Z');
    await db.upsertProducts([{ ...rows[0], source: prefix, product_url: `https://example.test/${prefix}` }]);
    assert.ok((await db.metadata()).sources.includes(prefix));
    const otherSource = await db.listProducts({ category: prefix, source: prefix });
    assert.equal(otherSource.total, 1);
    assert.equal(otherSource.products[0].source, prefix);
    assert.equal((await db.listProducts({ category: prefix, source: 'daraz' })).total, 1105);
    const permissions = (await client.query(`SELECT
      has_table_privilege('anigadgets_reader', 'products', 'SELECT') AS can_read,
      has_table_privilege('anigadgets_reader', 'products', 'INSERT') AS can_insert,
      has_table_privilege('anigadgets_reader', 'products', 'UPDATE') AS can_update,
      has_table_privilege('anigadgets_writer', 'products', 'DELETE') AS writer_delete`)).rows[0];
    assert.deepEqual(permissions, { can_read: true, can_insert: false, can_update: false, writer_delete: false });
    await client.query('ROLLBACK');
    assert.equal((await createRepository(pool).listProducts({ category: prefix })).total, 0);
    await assert.rejects(createRepository(pool).transaction(async store => {
      await store.upsertProducts([rows[0]]);
      throw new Error('intentional rollback');
    }), /intentional rollback/);
    assert.equal((await createRepository(pool).listProducts({ category: prefix })).total, 0);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});