function createCatalogueRepository(connection) {
  return {
    async list({ search = '', category = '', limit = 20, offset = 0 }) {
      return (await connection.query(`WITH filtered AS (
        SELECT * FROM public.catalogue_public WHERE ($1 = '' OR strpos(lower(name || ' ' || coalesce(anime_name, '') || ' ' || coalesce(manufacturer_code, '') || ' ' || coalesce(isbn, '')), lower($1)) > 0)
          AND ($2 = '' OR category = $2)
      ), page AS (SELECT * FROM filtered ORDER BY id LIMIT $3 OFFSET $4)
      SELECT (SELECT count(*)::int FROM filtered) AS total,
        coalesce((SELECT jsonb_agg(page ORDER BY id) FROM page), '[]'::jsonb) AS products`, [search, category, limit, offset])).rows[0];
    },
    async detail(id) {
      // One statement/snapshot prevents partial publication or mixed observation revisions.
      return (await connection.query(`SELECT to_jsonb(p) AS product,
        coalesce((SELECT jsonb_agg(o ORDER BY id) FROM public.catalogue_offers_public o WHERE o.catalogue_product_id = p.id), '[]'::jsonb) AS offers,
        coalesce((SELECT jsonb_agg(e) FROM public.catalogue_evidence_public e WHERE e.catalogue_product_id = p.id
          OR e.offer_id IN (SELECT id FROM public.catalogue_offers_public WHERE catalogue_product_id = p.id)), '[]'::jsonb) AS evidence,
        coalesce((SELECT jsonb_agg(h ORDER BY h.observed_at DESC) FROM (
          SELECT h.* FROM public.catalogue_offers_public o CROSS JOIN LATERAL (
            SELECT * FROM public.catalogue_history_public n WHERE n.offer_id = o.id ORDER BY observed_at DESC LIMIT 20
          ) h WHERE o.catalogue_product_id = p.id
        ) h), '[]'::jsonb) AS history
        FROM public.catalogue_public p WHERE p.id = $1`, [id])).rows[0] || null;
    }
  };
}
module.exports = { createCatalogueRepository };