const PRODUCT_COLUMNS = [
  'name', 'product_url', 'image_url', 'price', 'original_price', 'rating', 'reviews_count',
  'units_sold', 'daraz_item_id', 'seller_name', 'location', 'brand', 'in_stock', 'is_available',
  'discount_percent', 'anime_name', 'category', 'source', 'search_keyword', 'scraped_at',
  'last_seen_at', 'first_seen_at', 'times_seen', 'intelligent_score', 'trending_score',
  'trending_status', 'trending_label', 'score_breakdown', 'score_explanation', 'score_version'
];
const SORT_FIELDS = new Set(['intelligent_score', 'price', 'scraped_at', 'reviews_count', 'times_seen', 'units_sold']);

function createRepository(connection) {
  const query = (text, values = []) => connection.query(text, values);
  return {
    async metadata() {
      return (await query('SELECT public.product_metadata() AS data')).rows[0].data;
    },
    async stats(minScore) {
      return (await query('SELECT public.platform_statistics($1) AS data', [minScore])).rows[0].data;
    },
    async lastUpdated() {
      const { rows } = await query(`SELECT max(scraped_at) AS newest,
        (SELECT count(*) FROM public.trending_anime) AS anime_count FROM public.products`);
      return rows[0].newest;
    },
    async listProducts({ limit = 20, offset = 0, minScore = 0, minPrice, maxPrice, category, anime, search, scoredOnly, sortBy, sortOrder } = {}) {
      const values = [];
      const clauses = ['p.is_available = true'];
      const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
      if (minScore > 0) add('p.intelligent_score >= ?', minScore);
      if (scoredOnly) clauses.push('p.intelligent_score IS NOT NULL');
      if (minPrice !== undefined) add('p.price >= ?', minPrice);
      if (maxPrice !== undefined) add('p.price <= ?', maxPrice);
      if (category) add('p.category = ?', category);
      if (anime) add('p.anime_name = ?', anime);
      if (search) add("p.search_document @@ websearch_to_tsquery('simple', ?)", search);
      const field = SORT_FIELDS.has(sortBy) ? sortBy : 'intelligent_score';
      const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
      values.push(limit, offset);
      // Single snapshot, including total when offset is beyond the last page.
      const { rows } = await query(`WITH filtered AS (
        SELECT p.* FROM public.products p WHERE ${clauses.join(' AND ')}
      ), page AS (
        SELECT * FROM filtered ORDER BY ${field} ${direction} NULLS LAST, id ASC
        LIMIT $${values.length - 1} OFFSET $${values.length}
      ) SELECT (SELECT count(*)::int FROM filtered) AS total,
        coalesce((SELECT jsonb_agg(to_jsonb(page) - 'search_document'
          ORDER BY ${field} ${direction} NULLS LAST, id ASC) FROM page), '[]'::jsonb) AS products`, values);
      return rows[0];
    },
    async getProduct(id) {
      return (await query("SELECT to_jsonb(p) - 'search_document' AS product FROM public.products p WHERE id = $1", [id])).rows[0]?.product || null;
    },
    async listAnime({ limit = 25, offset = 0 } = {}) {
      return (await query('SELECT * FROM public.trending_anime ORDER BY popularity_rank, id LIMIT $1 OFFSET $2', [limit, offset])).rows;
    },
    async getAnime(malId) {
      return (await query('SELECT * FROM public.trending_anime WHERE mal_id = $1', [malId])).rows[0] || null;
    },
    async findExisting(urls) {
      return (await query(`SELECT product_url, first_seen_at, created_at, times_seen, search_keyword
        FROM public.products WHERE product_url = ANY($1::text[])`, [urls])).rows;
    },
    async upsertProducts(rows) {
      if (!rows.length) return;
      const values = [];
      const tuples = rows.map(row => `(${PRODUCT_COLUMNS.map(column => {
        values.push(row[column] ?? null);
        return `$${values.length}`;
      }).join(',')})`);
      const updates = PRODUCT_COLUMNS.filter(column => column !== 'product_url' && column !== 'first_seen_at')
        .map(column => `${column} = EXCLUDED.${column}`).join(',');
      await query(`INSERT INTO public.products (${PRODUCT_COLUMNS.join(',')}) VALUES ${tuples.join(',')}
        ON CONFLICT (product_url) DO UPDATE SET ${updates}
        WHERE products.scraped_at <= EXCLUDED.scraped_at`, values);
    },
    async retireMissing(scopes, now) {
      await query(`UPDATE public.products SET is_available = false
        WHERE source = 'daraz' AND search_keyword = ANY($1::text[]) AND last_seen_at < $2`, [scopes, now]);
    },
    async upsertAnime(anime) {
      const columns = ['mal_id', 'title', 'title_english', 'anime_name', 'image_url', 'score', 'members', 'popularity_rank', 'status', 'season', 'year'];
      await query(`INSERT INTO public.trending_anime (${columns.join(',')})
        VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT (mal_id) DO UPDATE SET
        ${columns.slice(1).map(column => `${column} = EXCLUDED.${column}`).join(',')}, updated_at = now()`, columns.map(column => anime[column] ?? null));
    },
    async transaction(work) {
      const client = await connection.connect();
      try {
        await client.query('BEGIN');
        // Serialize writers, including manual runs; fail fast rather than overlap.
        const lock = await client.query('SELECT pg_try_advisory_xact_lock(748215) AS locked');
        if (!lock.rows[0].locked) throw new Error('Another ingestion is committing; retry later');
        const result = await work(createRepository(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }
  };
}
module.exports = { createRepository, PRODUCT_COLUMNS };