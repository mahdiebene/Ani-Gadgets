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
CREATE INDEX IF NOT EXISTS idx_products_source ON public.products(source) WHERE is_available;

-- Additive catalogue foundation. Legacy products remain listings, not reviewed identities.
-- These tables are owner-managed until a permission-gated curation/import workflow exists.
CREATE TABLE IF NOT EXISTS public.catalogue_products (
  id serial PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  category text NOT NULL,
  anime_name text,
  manufacturer text,
  product_line text,
  manufacturer_code text,
  isbn text,
  edition text,
  variant text,
  scale text,
  language text,
  volume text,
  identity_status text NOT NULL DEFAULT 'unreviewed' CHECK (identity_status IN ('unreviewed', 'reviewed')),
  identity_reference_url text CHECK (identity_reference_url ~ '^https?://[^[:space:]]+$'),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (identity_status <> 'reviewed' OR
    (nullif(btrim(reviewed_by), '') IS NOT NULL AND reviewed_at IS NOT NULL AND identity_reference_url IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.merchants (
  id serial PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  website_url text CHECK (website_url ~ '^https?://[^[:space:]]+$'),
  country_code text CHECK (country_code ~ '^[A-Z]{2}$'),
  data_permission text NOT NULL DEFAULT 'unknown' CHECK (data_permission IN ('unknown', 'granted', 'denied', 'revoked')),
  image_permission text NOT NULL DEFAULT 'unknown' CHECK (image_permission IN ('unknown', 'granted', 'denied', 'revoked')),
  data_permission_reference text,
  image_permission_reference text,
  permission_checked_at timestamptz,
  permission_expires_at timestamptz,
  refresh_interval_hours integer CHECK (refresh_interval_hours > 0),
  payment_policy_url text CHECK (payment_policy_url ~ '^https?://[^[:space:]]+$'),
  delivery_policy_url text CHECK (delivery_policy_url ~ '^https?://[^[:space:]]+$'),
  return_policy_url text CHECK (return_policy_url ~ '^https?://[^[:space:]]+$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_permission <> 'granted' OR
    (nullif(btrim(data_permission_reference), '') IS NOT NULL AND permission_checked_at IS NOT NULL)),
  CHECK (image_permission <> 'granted' OR
    (nullif(btrim(image_permission_reference), '') IS NOT NULL AND permission_checked_at IS NOT NULL)),
  CHECK (permission_expires_at IS NULL OR
    (permission_checked_at IS NOT NULL AND permission_expires_at > permission_checked_at))
);

CREATE TABLE IF NOT EXISTS public.offers (
  id serial PRIMARY KEY,
  merchant_id integer NOT NULL REFERENCES public.merchants(id),
  catalogue_product_id integer REFERENCES public.catalogue_products(id),
  legacy_product_id integer UNIQUE REFERENCES public.products(id),
  listing_url text NOT NULL CHECK (listing_url ~ '^https?://[^[:space:]]+$'),
  merchant_sku text,
  match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'candidate', 'reviewed')),
  match_reviewed_by text,
  match_reviewed_at timestamptz,
  condition text NOT NULL DEFAULT 'unknown' CHECK (condition IN ('unknown', 'new', 'used', 'damaged')),
  included_parts text,
  purchase_route text NOT NULL DEFAULT 'unknown' CHECK (purchase_route IN ('unknown', 'local', 'direct_import', 'proxy', 'request')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, listing_url),
  CHECK ((match_status = 'unmatched' AND catalogue_product_id IS NULL) OR
    (match_status IN ('candidate', 'reviewed') AND catalogue_product_id IS NOT NULL)),
  CHECK (match_status <> 'reviewed' OR
    (nullif(btrim(match_reviewed_by), '') IS NOT NULL AND match_reviewed_at IS NOT NULL))
);

-- Monetary values are in the stated currency. Null means unknown, not free.
-- No landed-total column: a future comparison service must check completeness/destination.
CREATE TABLE IF NOT EXISTS public.offer_observations (
  id bigserial PRIMARY KEY,
  offer_id integer NOT NULL REFERENCES public.offers(id),
  observed_at timestamptz NOT NULL,
  expires_at timestamptz,
  observation_method text NOT NULL CHECK (observation_method IN ('manual', 'partner_feed', 'approved_api')),
  source_reference text NOT NULL CHECK (btrim(source_reference) <> ''),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  price_kind text NOT NULL DEFAULT 'unknown' CHECK (price_kind IN ('unknown', 'full', 'deposit')),
  full_price numeric(14,2) CHECK (full_price >= 0 AND full_price < 1000000000000),
  deposit_amount numeric(14,2) CHECK (deposit_amount >= 0 AND deposit_amount < 1000000000000),
  shipping_amount numeric(14,2) CHECK (shipping_amount >= 0 AND shipping_amount < 1000000000000),
  tax_amount numeric(14,2) CHECK (tax_amount >= 0 AND tax_amount < 1000000000000),
  fee_amount numeric(14,2) CHECK (fee_amount >= 0 AND fee_amount < 1000000000000),
  ships_to_bangladesh boolean,
  delivery_destination text,
  availability text NOT NULL DEFAULT 'unknown' CHECK (availability IN ('unknown', 'in_stock', 'out_of_stock', 'preorder', 'discontinued')),
  preorder_release_at date,
  preorder_terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, observed_at),
  CHECK (expires_at IS NULL OR expires_at > observed_at),
  CHECK (price_kind <> 'full' OR full_price IS NOT NULL),
  CHECK (price_kind <> 'deposit' OR deposit_amount IS NOT NULL),
  CHECK (deposit_amount IS NULL OR full_price IS NULL OR deposit_amount <= full_price),
  CHECK (shipping_amount IS NULL OR nullif(btrim(delivery_destination), '') IS NOT NULL)
);

-- Evidence records describe provenance, not an automatic authenticity verdict.
CREATE TABLE IF NOT EXISTS public.evidence_records (
  id bigserial PRIMARY KEY,
  catalogue_product_id integer REFERENCES public.catalogue_products(id),
  merchant_id integer REFERENCES public.merchants(id),
  offer_id integer REFERENCES public.offers(id),
  evidence_type text NOT NULL CHECK (evidence_type IN ('seller_claim', 'manufacturer_reference', 'independent_review')),
  source_url text NOT NULL CHECK (source_url ~ '^https?://[^[:space:]]+$'),
  summary text NOT NULL CHECK (btrim(summary) <> ''),
  captured_at timestamptz NOT NULL,
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed', 'reviewed', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(catalogue_product_id, merchant_id, offer_id) = 1),
  CHECK (review_status = 'unreviewed' OR
    (nullif(btrim(reviewed_by), '') IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (expires_at IS NULL OR expires_at > captured_at)
);

CREATE INDEX IF NOT EXISTS idx_offers_catalogue_product ON public.offers(catalogue_product_id);
CREATE INDEX IF NOT EXISTS idx_observations_latest ON public.offer_observations(offer_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_product ON public.evidence_records(catalogue_product_id);
CREATE INDEX IF NOT EXISTS idx_evidence_merchant ON public.evidence_records(merchant_id);
CREATE INDEX IF NOT EXISTS idx_evidence_offer ON public.evidence_records(offer_id);
REVOKE ALL ON public.catalogue_products, public.merchants, public.offers,
  public.offer_observations, public.evidence_records FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.catalogue_products_id_seq, public.merchants_id_seq,
  public.offers_id_seq, public.offer_observations_id_seq, public.evidence_records_id_seq FROM PUBLIC;

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
      (SELECT DISTINCT anime_name FROM public.products WHERE is_available AND anime_name IS NOT NULL) a), '[]'::jsonb),
    'sources', coalesce((SELECT jsonb_agg(source ORDER BY source) FROM
      (SELECT DISTINCT source FROM public.products WHERE is_available AND source IS NOT NULL AND btrim(source) <> '') s), '[]'::jsonb)
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

-- Solo curation is opt-in and independent of the legacy permission/feed fields.
-- No feeds/images are fetched: published content is manually authored by the operator.
ALTER TABLE public.catalogue_products ADD COLUMN IF NOT EXISTS curation_key text UNIQUE;
ALTER TABLE public.catalogue_products ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;
ALTER TABLE public.catalogue_products ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS curation_key text UNIQUE;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS curation_key text UNIQUE;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;
ALTER TABLE public.evidence_records ADD COLUMN IF NOT EXISTS curation_key text UNIQUE;

-- Explicit allowlists: private reviewer, provenance and permission records never leave SQL.
CREATE OR REPLACE VIEW public.catalogue_public WITH (security_barrier = true) AS
  SELECT id, name, category, anime_name, manufacturer, product_line, manufacturer_code,
    isbn, edition, variant, scale, language, volume, identity_reference_url, is_demo
  FROM public.catalogue_products WHERE published AND identity_status = 'reviewed';
CREATE OR REPLACE VIEW public.catalogue_offers_public WITH (security_barrier = true) AS
  SELECT o.id, o.catalogue_product_id, o.listing_url, o.condition, o.included_parts,
    o.purchase_route, m.name AS merchant_name, m.payment_policy_url, m.delivery_policy_url,
    m.return_policy_url, n.observed_at, n.expires_at, n.currency, n.price_kind,
    n.full_price, n.deposit_amount, n.shipping_amount, n.tax_amount, n.fee_amount,
    n.ships_to_bangladesh, n.delivery_destination, n.availability,
    n.preorder_release_at, n.preorder_terms
  FROM public.offers o JOIN public.catalogue_public p ON p.id = o.catalogue_product_id
  JOIN public.merchants m ON m.id = o.merchant_id AND m.published
  LEFT JOIN LATERAL (SELECT * FROM public.offer_observations n WHERE n.offer_id = o.id
    ORDER BY observed_at DESC, id DESC LIMIT 1) n ON true
  WHERE o.published AND o.match_status = 'reviewed';
CREATE OR REPLACE VIEW public.catalogue_history_public WITH (security_barrier = true) AS
  SELECT n.offer_id, n.observed_at, n.expires_at, n.currency, n.price_kind, n.full_price,
    n.deposit_amount, n.shipping_amount, n.tax_amount, n.fee_amount, n.availability
  FROM public.offer_observations n JOIN public.catalogue_offers_public o ON o.id = n.offer_id;
CREATE OR REPLACE VIEW public.catalogue_evidence_public WITH (security_barrier = true) AS
  SELECT e.catalogue_product_id, e.offer_id, e.evidence_type, e.source_url, e.summary,
    e.captured_at, e.expires_at
  FROM public.evidence_records e WHERE e.review_status = 'reviewed'
    AND e.captured_at <= now() AND (e.expires_at IS NULL OR e.expires_at > now())
    AND (EXISTS (SELECT 1 FROM public.catalogue_public p WHERE p.id = e.catalogue_product_id)
      OR EXISTS (SELECT 1 FROM public.catalogue_offers_public o WHERE o.id = e.offer_id));
REVOKE ALL ON public.catalogue_public, public.catalogue_offers_public,
  public.catalogue_history_public, public.catalogue_evidence_public FROM PUBLIC;

COMMIT;