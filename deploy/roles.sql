-- Run inside the PostgreSQL container as its owner. No password literals in source.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anigadgets_reader') THEN
    CREATE ROLE anigadgets_reader LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anigadgets_writer') THEN
    CREATE ROLE anigadgets_writer LOGIN;
  END IF;
  EXECUTE format('ALTER ROLE anigadgets_reader PASSWORD %L',
    btrim(pg_read_file('/run/secrets/db_reader_password'), E'\r\n '));
  EXECUTE format('ALTER ROLE anigadgets_writer PASSWORD %L',
    btrim(pg_read_file('/run/secrets/db_writer_password'), E'\r\n '));
END $$;
ALTER ROLE anigadgets_reader SET default_transaction_read_only = on;
REVOKE ALL ON DATABASE anigadgets FROM PUBLIC;
GRANT CONNECT ON DATABASE anigadgets TO anigadgets_reader, anigadgets_writer;
GRANT USAGE ON SCHEMA public TO anigadgets_reader, anigadgets_writer;
REVOKE ALL ON public.products, public.trending_anime FROM anigadgets_reader, anigadgets_writer;
GRANT SELECT ON public.products, public.trending_anime TO anigadgets_reader, anigadgets_writer;
GRANT INSERT, UPDATE ON public.products, public.trending_anime TO anigadgets_writer;
GRANT USAGE, SELECT ON SEQUENCE public.products_id_seq, public.trending_anime_id_seq TO anigadgets_writer;
GRANT EXECUTE ON FUNCTION public.product_metadata(), public.platform_statistics(integer)
  TO anigadgets_reader, anigadgets_writer;
-- Curated catalogue is deliberately owner-only until the reviewed import workflow exists.
-- In particular, the Daraz writer cannot manufacture matches/evidence or rewrite history.
REVOKE ALL ON public.catalogue_products, public.merchants, public.offers,
  public.offer_observations, public.evidence_records FROM anigadgets_reader, anigadgets_writer;
REVOKE ALL ON SEQUENCE public.catalogue_products_id_seq, public.merchants_id_seq,
  public.offers_id_seq, public.offer_observations_id_seq, public.evidence_records_id_seq
  FROM anigadgets_reader, anigadgets_writer;
COMMIT;