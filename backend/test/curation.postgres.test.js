const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPool } = require('../src/db/pool');
const { importDocument } = require('../src/catalogue/import');
const { createDemo } = require('../src/catalogue/demo');
const { createCatalogueRepository } = require('../src/catalogue/repository');
const { compareOffers } = require('../src/catalogue/comparison');

test('real PostgreSQL: solo import, privacy, publication, append-only history, rollback and scoped roles', {
  skip: process.env.TEST_DATABASE !== '1'
}, async () => {
  const pool = createPool();
  // Unique keys avoid interference with the legacy integration files running in parallel.
  const prefix = `test-${Date.now()}-`;
  const doc = createDemo(Date.now(), 2);
  for (const section of ['products', 'merchants', 'offers', 'evidence']) {
    for (const row of doc[section]) row.key = prefix + row.key;
  }
  for (const section of ['offers', 'observations', 'evidence']) {
    for (const row of doc[section]) for (const field of ['product', 'merchant', 'offer']) if (row[field]) row[field] = prefix + row[field];
  }
  for (const offer of doc.offers) offer.listing_url += `?test=${prefix}`;
  const repo = createCatalogueRepository(pool);
  const reader = await pool.connect();
  const writer = await pool.connect();
  try {
    const counts = await importDocument(pool, doc);
    assert.equal(counts.products, 2); assert.equal(counts.observations, 4);
    assert.equal((await importDocument(pool, doc)).observations, 0, 'same observation is idempotent');
    const id = (await pool.query('SELECT id FROM public.catalogue_products WHERE curation_key = $1', [doc.products[0].key])).rows[0].id;
    await reader.query('SET ROLE anigadgets_reader');
    const publicRepo = createCatalogueRepository(reader);
    const detail = await publicRepo.detail(id);
    assert.equal(detail.offers.length, 2); assert.equal(detail.history.length, 2); assert.equal(detail.evidence.length, 1);
    for (const secret of ['reviewed_by', 'source_reference', 'data_permission', 'curation_key']) assert.equal(JSON.stringify(detail).includes(secret), false);
    assert.equal(compareOffers(detail.offers)[0].lowest_complete_total, true);
    assert.ok((await publicRepo.list({ search: 'Demo figure' })).total >= 1);
    assert.equal((await publicRepo.list({ search: "'); DROP TABLE products; --" })).total, 0);
    await assert.rejects(reader.query('SELECT * FROM public.merchants'), e => e.code === '42501');
    await assert.rejects(reader.query('INSERT INTO public.catalogue_products(name, category) VALUES (\'x\', \'x\')'), e => e.code === '42501');
    await writer.query('SET ROLE anigadgets_writer');
    await assert.rejects(writer.query('SELECT * FROM public.catalogue_public'), e => e.code === '42501');
    // Neither operational role can edit, delete or truncate observation history.
    for (const role of ['anigadgets_curator', 'anigadgets_importer']) {
      await writer.query(`RESET ROLE; SET ROLE ${role}`);
      for (const sql of ['UPDATE public.offer_observations SET full_price = 0', 'DELETE FROM public.offer_observations', 'TRUNCATE public.offer_observations']) {
        await assert.rejects(writer.query(sql), e => e.code === '42501');
      }
    }
    await assert.rejects(writer.query("UPDATE public.offers SET match_status = 'reviewed'"), e => e.code === '42501');
    await assert.rejects(writer.query('SELECT * FROM public.merchants'), e => e.code === '42501');
    await assert.rejects(writer.query('SELECT match_reviewed_by FROM public.offers'), e => e.code === '42501');
    // Untrusted reader credentials cannot SET ROLE to curate.
    const denyPool = { connect: async () => ({
      query: (...args) => reader.query(...args), release() {}
    }) };
    // SET ROLE checks session_user, so use session authorization in this disposable owner session.
    await reader.query('RESET ROLE; SET SESSION AUTHORIZATION anigadgets_reader');
    await assert.rejects(importDocument(denyPool, doc), e => e.code === '42501');
    await reader.query('RESET SESSION AUTHORIZATION');

    const changed = structuredClone(doc); changed.products[0].name = 'Should roll back'; changed.observations[0].full_price = 900;
    await assert.rejects(importDocument(pool, changed), /already exists with different/);
    assert.equal((await repo.detail(id)).product.name, doc.products[0].name);
    const remap = structuredClone(doc); remap.offers[0].condition = 'used';
    await assert.rejects(importDocument(pool, remap), /immutable/);
    const variant = structuredClone(doc); variant.products[0].variant = 'Different edition';
    await assert.rejects(importDocument(pool, variant), /immutable/);
    const missing = structuredClone(doc); missing.products[0].name = 'Also rolls back'; missing.offers[0].merchant = 'not-present';
    await assert.rejects(importDocument(pool, missing), /Unknown merchants key/);
    assert.equal((await repo.detail(id)).product.name, doc.products[0].name);

    const update = { version: 1, mode: 'observations', observations: [{ ...doc.observations[0], observed_at: new Date(Date.now() - 1000).toISOString(), full_price: 950 }] };
    assert.equal((await importDocument(pool, update)).observations, 1);
    assert.equal((await repo.detail(id)).history.length, 3);
    assert.equal((await repo.detail(id)).offers[0].full_price, 950);
    doc.products[0].published = false;
    await importDocument(pool, doc);
    assert.equal(await repo.detail(id), null);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.catalogue_history_public WHERE offer_id = $1', [detail.offers[0].id])).rows[0].n, 0);
    doc.products[0].published = true; doc.merchants[0].published = false;
    await importDocument(pool, doc);
    assert.equal((await repo.detail(id)).offers.length, 1);
    doc.merchants[0].published = true; doc.offers[0].reviewed = false; doc.offers[0].published = false;
    doc.evidence[0].reviewed = false;
    await importDocument(pool, doc);
    assert.equal((await repo.detail(id)).offers.length, 1);
    assert.equal((await repo.detail(id)).evidence.length, 0);
    doc.evidence[0].reviewed = true;
    doc.evidence[0].expires_at = new Date(Date.now() - 1000).toISOString();
    await importDocument(pool, doc);
    assert.equal((await repo.detail(id)).evidence.length, 0, 'expired references are not public');
    doc.products[0].reviewed = false; doc.products[0].published = false;
    await importDocument(pool, doc);
    assert.equal(await repo.detail(id), null);
  } finally {
    await reader.query('RESET SESSION AUTHORIZATION; RESET ROLE'); reader.release();
    await writer.query('RESET ROLE'); writer.release();
    // Owner-only cleanup in an opt-in disposable DB, never an operational role.
    await pool.query('DELETE FROM public.evidence_records WHERE curation_key LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM public.offer_observations WHERE offer_id IN (SELECT id FROM public.offers WHERE curation_key LIKE $1)', [`${prefix}%`]);
    await pool.query('DELETE FROM public.offers WHERE curation_key LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM public.catalogue_products WHERE curation_key LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM public.merchants WHERE curation_key LIKE $1', [`${prefix}%`]);
    await pool.end();
  }
});