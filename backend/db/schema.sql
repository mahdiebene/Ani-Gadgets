-- Canonical PostgreSQL schema. Run as the database owner; safe to reapply.
-- Runtime roles are provisioned separately and never own these objects.
BEGIN;

CREATE TABLE IF NOT EXISTS public.trending_anime (
  id serial PRIMARY KEY,
  mal_id integer UNIQUE NOT NULL,
  title varchar(255) NOT NULL,
  title_english varchar(255),
  image_url text,
  score numeric(4,2),
  members integer DEFAULT 0,
  popularity_rank integer,
  status varchar(50),
  season varchar(20),
  year integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Canonical name matches the local BD dataset, not necessarily the MAL title.
ALTER TABLE public.trending_anime ADD COLUMN IF NOT EXISTS anime_name text;

CREATE TABLE IF NOT EXISTS public.products (
  id serial PRIMARY KEY,
  name varchar(500) NOT NULL,
  product_url text NOT NULL UNIQUE,
  price numeric(10,2),
  original_price numeric(10,2),
  image_url text,
  source varchar(50) DEFAULT 'daraz',
  created_at timestamptz DEFAULT now(),
  scraped_at timestamptz DEFAULT now()
);
-- Also upgrades the previous checked-in schema without dropping any rows.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS anime_name varchar(255),
  ADD COLUMN IF NOT EXISTS search_keyword varchar(255),
  ADD COLUMN IF NOT EXISTS category varchar(100),
  ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating numeric(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trending_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trending_status varchar(20) DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS trending_label varchar(50),
  ADD COLUMN IF NOT EXISTS intelligent_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS score_explanation text,
  ADD COLUMN IF NOT EXISTS score_version integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS times_seen integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS units_sold integer NOT NULL DEFAULT 0 CHECK (units_sold >= 0),
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS in_stock boolean,
  ADD COLUMN IF NOT EXISTS daraz_item_id bigint,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS discount_percent integer DEFAULT 0;

UPDATE public.products SET first_seen_at = coalesce(created_at, scraped_at, now())
WHERE first_seen_at IS NULL;
ALTER TABLE public.products ALTER COLUMN first_seen_at SET DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS search_document tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(anime_name, ''))) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_url ON public.products(product_url);
CREATE INDEX IF NOT EXISTS idx_products_intelligent_score ON public.products(intelligent_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_anime_name ON public.products(anime_name);
CREATE INDEX IF NOT EXISTS idx_products_available ON public.products(is_available);
CREATE INDEX IF NOT EXISTS idx_products_scraped_at ON public.products(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products USING gin(search_document);
CREATE INDEX IF NOT EXISTS idx_products_search_keyword ON public.products(search_keyword);

-- There is no public database endpoint. Runtime access uses PostgreSQL grants.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON public.products, public.trending_anime FROM PUBLIC;

-- Compute aggregates in the database; never fetch the entire catalogue for metadata.
CREATE OR REPLACE FUNCTION public.product_metadata()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'categories', coalesce((SELECT jsonb_agg(category ORDER BY category) FROM
      (SELECT DISTINCT category FROM public.products WHERE is_available AND category IS NOT NULL) c), '[]'::jsonb),
    'anime', coalesce((SELECT jsonb_agg(anime_name ORDER BY anime_name) FROM
      (SELECT DISTINCT anime_name FROM public.products WHERE is_available AND anime_name IS NOT NULL) a), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_statistics(min_score integer DEFAULT 45)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH available AS (SELECT * FROM public.products WHERE is_available),
  trending AS (SELECT * FROM available WHERE intelligent_score >= min_score)
  SELECT jsonb_build_object(
    'totalProducts', (SELECT count(*) FROM available),
    'trendingProducts', (SELECT count(*) FROM trending),
    'totalAnime', (SELECT count(DISTINCT anime_name) FROM available WHERE anime_name <> 'Anime'),
    'topAnimeByProducts', coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM (
      SELECT anime_name AS title, count(*) AS "productCount" FROM trending
      WHERE anime_name IS NOT NULL GROUP BY anime_name ORDER BY count(*) DESC, anime_name LIMIT 5
    ) a), '[]'::jsonb),
    'priceRange', (SELECT jsonb_build_object('min', coalesce(min(price), 0),
      'max', coalesce(max(price), 0), 'average', coalesce(round(avg(price)), 0)) FROM trending WHERE price > 0),
    'lastUpdated', (SELECT max(scraped_at) FROM public.products),
    'currency', 'BDT'
  );
$$;
REVOKE ALL ON FUNCTION public.product_metadata(), public.platform_statistics(integer) FROM PUBLIC;

COMMIT;