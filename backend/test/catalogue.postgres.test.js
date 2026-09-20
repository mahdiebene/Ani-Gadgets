const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPool } = require('../src/db/pool');

test('real PostgreSQL: catalogue relationships, unknown costs, review gates and runtime isolation', {
  skip: process.env.TEST_DATABASE !== '1'
}, async () => {
  const pool = createPool();
  const client = await pool.connect();
  async function rejectsConstraint(sql, values = [], code = '23514') {
    await client.query('SAVEPOINT invalid_row');
    await assert.rejects(client.query(sql, values), error => error.code === code);
    await client.query('ROLLBACK TO SAVEPOINT invalid_row');
    await client.query('RELEASE SAVEPOINT invalid_row');
  }
  try {
    await client.query('BEGIN');
    const product = (await client.query(`INSERT INTO public.catalogue_products(name, category)
      VALUES ('Test figure', 'Figures') RETURNING *`)).rows[0];
    assert.equal(product.identity_status, 'unreviewed');
    await rejectsConstraint(`UPDATE public.catalogue_products SET identity_status = 'reviewed' WHERE id = $1`, [product.id]);
    const merchant = (await client.query(`INSERT INTO public.merchants(name) VALUES ('Test merchant') RETURNING *`)).rows[0];
    assert.equal(merchant.data_permission, 'unknown');
    assert.equal(merchant.image_permission, 'unknown');
    await rejectsConstraint(`UPDATE public.merchants SET data_permission = 'granted' WHERE id = $1`, [merchant.id]);
    await rejectsConstraint(`UPDATE public.merchants SET image_permission = 'granted' WHERE id = $1`, [merchant.id]);
    await client.query(`UPDATE public.merchants SET data_permission = 'granted',
      data_permission_reference = 'Test-only permission record', permission_checked_at = now() WHERE id = $1`, [merchant.id]);
    const offer = (await client.query(`INSERT INTO public.offers(merchant_id, listing_url)
      VALUES ($1, 'https://example.test/figure') RETURNING *`, [merchant.id])).rows[0];
    assert.equal(offer.catalogue_product_id, null);
    assert.equal(offer.match_status, 'unmatched');
    await rejectsConstraint(`UPDATE public.offers SET match_status = 'reviewed', catalogue_product_id = $1 WHERE id = $2`, [product.id, offer.id]);
    await client.query(`UPDATE public.offers SET match_status = 'candidate', catalogue_product_id = $1 WHERE id = $2`, [product.id, offer.id]);
    const observation = (await client.query(`INSERT INTO public.offer_observations
      (offer_id, observed_at, observation_method, source_reference, currency, price_kind, deposit_amount, availability)
      VALUES ($1, now(), 'manual', 'Test-only source', 'BDT', 'deposit', 500, 'preorder') RETURNING *`, [offer.id])).rows[0];
    assert.equal(observation.full_price, null);
    assert.equal(observation.shipping_amount, null);
    assert.equal(observation.tax_amount, null);
    assert.equal(observation.ships_to_bangladesh, null);
    assert.equal(observation.deposit_amount, 500);
    for (const assignment of ["full_price = -1", "full_price = 'NaN'", 'full_price = 100',
      'deposit_amount = NULL', 'shipping_amount = 0', 'expires_at = observed_at', "currency = 'bdt'"]) {
      await rejectsConstraint(`UPDATE public.offer_observations SET ${assignment} WHERE id = $1`, [observation.id]);
    }
    await client.query(`UPDATE public.offer_observations SET shipping_amount = 0, delivery_destination = 'Dhaka'
      WHERE id = $1`, [observation.id]);
    const evidence = (await client.query(`INSERT INTO public.evidence_records
      (offer_id, evidence_type, source_url, summary, captured_at)
      VALUES ($1, 'seller_claim', 'https://example.test/figure', 'Seller claims origin; not verified.', now()) RETURNING *`, [offer.id])).rows[0];
    assert.equal(evidence.review_status, 'unreviewed');
    await rejectsConstraint(`UPDATE public.evidence_records SET merchant_id = $1 WHERE id = $2`, [merchant.id, evidence.id]);
    await rejectsConstraint(`UPDATE public.evidence_records SET review_status = 'reviewed' WHERE id = $1`, [evidence.id]);
    await rejectsConstraint(`DELETE FROM public.merchants WHERE id = $1`, [merchant.id], '23503');
    for (const role of ['anigadgets_reader', 'anigadgets_writer']) {
      for (const table of ['catalogue_products', 'merchants', 'offers', 'offer_observations', 'evidence_records']) {
        const result = (await client.query(`SELECT
          has_table_privilege($1, $2, 'SELECT') AS can_read,
          has_table_privilege($1, $2, 'INSERT') AS can_insert,
          has_table_privilege($1, $2, 'UPDATE') AS can_update,
          has_table_privilege($1, $2, 'DELETE') AS can_delete`, [role, `public.${table}`])).rows[0];
        assert.deepEqual(result, { can_read: false, can_insert: false, can_update: false, can_delete: false });
      }
    }
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});