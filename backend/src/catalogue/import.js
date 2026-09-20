const { validateDocument } = require('./validation');

async function importDocument(pool, input) {
  const doc = validateDocument(input);
  const client = await pool.connect();
  const counts = { products: 0, merchants: 0, offers: 0, observations: 0, evidence: 0 };
  const now = new Date().toISOString();
  const resolve = async (table, key) => {
    const row = (await client.query(`SELECT id FROM public.${table} WHERE curation_key = $1`, [key])).rows[0];
    if (!row) throw new Error(`Unknown ${table} key: ${key}`);
    return row.id;
  };
  // Table/column identifiers below are hardcoded, never supplied by the JSON file.
  async function upsert(table, row) {
    const columns = Object.keys(row);
    return (await client.query(`INSERT INTO public.${table} (${columns.join(',')})
      VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})
      ON CONFLICT (curation_key) DO UPDATE SET ${columns.filter(c => c !== 'curation_key').map(c => `${c} = EXCLUDED.${c}`).join(',')}
      RETURNING id`, Object.values(row))).rows[0].id;
  }
  const pick = (row, names) => Object.fromEntries(names.split(' ').map(key => [key, row[key] ?? null]));
  try {
    await client.query('BEGIN');
    await client.query(doc.mode === 'curation' ? 'SET LOCAL ROLE anigadgets_curator' : 'SET LOCAL ROLE anigadgets_importer');
    const lock = (await client.query('SELECT pg_try_advisory_xact_lock(748216) AS locked')).rows[0].locked;
    if (!lock) throw new Error('Another catalogue import is running');
    for (const row of doc.products) {
      const identity = { ...pick(row, 'category anime_name manufacturer product_line manufacturer_code isbn edition variant scale language volume'), is_demo: row.is_demo };
      const existing = (await client.query('SELECT * FROM public.catalogue_products WHERE curation_key = $1', [row.key])).rows[0];
      if (existing && Object.entries(identity).some(([key, value]) => existing[key] !== value)) {
        throw new Error(`Product ${row.key}: identity attributes are immutable; unpublish and use a new key`);
      }
      await upsert('catalogue_products', {
        curation_key: row.key, ...pick(row, 'name category anime_name manufacturer product_line manufacturer_code isbn edition variant scale language volume identity_reference_url'),
        identity_status: row.reviewed ? 'reviewed' : 'unreviewed', reviewed_by: row.reviewed ? doc.reviewer : null,
        reviewed_at: row.reviewed ? now : null, updated_at: now, published: row.published, is_demo: row.is_demo
      });
      counts.products++;
    }
    for (const row of doc.merchants) {
      await upsert('merchants', { curation_key: row.key, ...pick(row, 'name website_url country_code payment_policy_url delivery_policy_url return_policy_url'), published: row.published });
      counts.merchants++;
    }
    for (const row of doc.offers) {
      const product = await resolve('catalogue_products', row.product);
      const merchant = await resolve('merchants', row.merchant);
      // Preserve the meaning of all historical observations. Correct identity/condition
      // mistakes by unpublishing this offer and using a new stable key, not remapping it.
      const existing = (await client.query(`SELECT * FROM public.offers WHERE curation_key = $1`, [row.key])).rows[0];
      const values = { catalogue_product_id: product, merchant_id: merchant,
        ...pick(row, 'listing_url condition included_parts purchase_route') };
      if (existing && Object.entries(values).some(([key, value]) => existing[key] !== value)) {
        throw new Error(`Offer ${row.key}: identity, merchant, URL, condition, parts and route are immutable; use a new key`);
      }
      await upsert('offers', { curation_key: row.key, ...values,
        match_status: row.reviewed ? 'reviewed' : 'candidate', match_reviewed_by: row.reviewed ? doc.reviewer : null,
        match_reviewed_at: row.reviewed ? now : null, published: row.published });
      counts.offers++;
    }
    for (const row of doc.observations) {
      const offer = await resolve('offers', row.offer);
      const values = { offer_id: offer, ...pick(row, 'observed_at expires_at source_reference currency price_kind full_price deposit_amount shipping_amount tax_amount fee_amount ships_to_bangladesh delivery_destination availability preorder_release_at preorder_terms'), observation_method: 'manual' };
      const columns = Object.keys(values);
      const inserted = await client.query(`INSERT INTO public.offer_observations (${columns.join(',')})
        VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT (offer_id, observed_at) DO NOTHING RETURNING id`, Object.values(values));
      if (!inserted.rowCount) {
        const same = await client.query(`SELECT id FROM public.offer_observations WHERE ${columns.map((c, i) => `${c} IS NOT DISTINCT FROM $${i + 1}`).join(' AND ')}`, Object.values(values));
        if (!same.rowCount) throw new Error(`Offer ${row.offer}: observation already exists with different values; append a new timestamp`);
      } else counts.observations++;
    }
    for (const row of doc.evidence) {
      await upsert('evidence_records', { curation_key: row.key,
        catalogue_product_id: row.product ? await resolve('catalogue_products', row.product) : null,
        offer_id: row.offer ? await resolve('offers', row.offer) : null,
        ...pick(row, 'evidence_type source_url summary captured_at expires_at'),
        review_status: row.reviewed ? 'reviewed' : 'unreviewed', reviewed_by: row.reviewed ? doc.reviewer : null,
        reviewed_at: row.reviewed ? now : null });
      counts.evidence++;
    }
    await client.query('COMMIT');
    return counts;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
module.exports = { importDocument };