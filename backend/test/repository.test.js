const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRepository } = require('../src/db/repository');

test('SQL uses parameters for every filter and allowlists ordering identifiers', async () => {
  const calls = [];
  const db = createRepository({ query: async (text, values) => {
    calls.push({ text, values }); return { rows: [{ products: [], total: 1100 }] };
  } });
  const malicious = "Naruto'); DROP TABLE products; --";
  await db.listProducts({ search: malicious, category: malicious, anime: malicious, minScore: 45,
    minPrice: 100, maxPrice: 2000, limit: 20, offset: 100, sortBy: malicious, sortOrder: malicious });
  assert.equal(calls[0].text.includes(malicious), false);
  assert.match(calls[0].text, /ORDER BY intelligent_score DESC NULLS LAST, id ASC/);
  assert.ok(calls[0].values.includes(malicious));
  assert.deepEqual(calls[0].values.slice(-2), [20, 100]);
  assert.match(calls[0].text, /websearch_to_tsquery/);
});

test('upsert uses fixed columns and parameters, preserving first seen on conflict', async () => {
  let sql;
  let values;
  const db = createRepository({ query: async (text, args) => { sql = text; values = args; } });
  await db.upsertProducts([{ name: "x'; --", product_url: 'https://example.test', score_breakdown: { salesEvidence: 25 } }]);
  assert.equal(sql.includes("x'; --"), false);
  assert.ok(values.includes("x'; --"));
  assert.match(sql, /ON CONFLICT \(product_url\) DO UPDATE/);
  assert.doesNotMatch(sql, /first_seen_at = EXCLUDED/);
});

test('transaction commits with one client, rolls back failures, and always releases', async () => {
  for (const fail of [false, true]) {
    const calls = [];
    const client = { query: async text => { calls.push(text); return { rows: [{ locked: true }] }; }, release: () => calls.push('release') };
    const db = createRepository({ connect: async () => client });
    const work = db.transaction(async store => {
      await store.retireMissing(['anime'], new Date().toISOString());
      if (fail) throw new Error('batch failed');
      return 42;
    });
    if (fail) await assert.rejects(work, /batch failed/);
    else assert.equal(await work, 42);
    assert.equal(calls[0], 'BEGIN');
    assert.deepEqual(calls.slice(-2), [fail ? 'ROLLBACK' : 'COMMIT', 'release']);
  }
});

test('overlapping transaction is rejected before any product changes', async () => {
  let called = false;
  const client = { query: async () => ({ rows: [{ locked: false }] }), release() {} };
  await assert.rejects(createRepository({ connect: async () => client }).transaction(async () => { called = true; }), /Another ingestion/);
  assert.equal(called, false);
});