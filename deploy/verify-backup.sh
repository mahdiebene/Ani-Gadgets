#!/bin/bash
# Restore only into a disposable, network-isolated PostgreSQL container.
set -euo pipefail
test "$(id -u)" = 0 || { echo 'Run with sudo.' >&2; exit 1; }
if [ "$#" -ne 1 ] || [ ! -s "$1" ]; then
  echo 'Usage: sudo bash /opt/anigadgets/deploy/verify-backup.sh /var/backups/anigadgets/<timestamp>.dump' >&2
  exit 1
fi
file=$(realpath -- "$1")
name="anigadgets-restore-check-$$"
container=
cleanup() {
  if [ -n "$container" ]; then docker rm -fv "$container" >/dev/null; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# No production volumes, passwords, network access or published ports.
# Trust auth is confined to this throwaway container's local socket.
container=$(docker run -d --pull=never --name "$name" --network none --memory 512m \
  --tmpfs /var/lib/postgresql/data:rw,size=256m \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=anigadgets postgres:17-bookworm)
ready=false
for attempt in {1..60}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d anigadgets >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  echo 'Restore-check database did not become ready.' >&2
  exit 1
fi
docker exec -i "$container" pg_restore -U postgres -d anigadgets \
  --no-owner --no-acl --exit-on-error < "$file"
docker exec -i "$container" psql -X -U postgres -d anigadgets -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  available integer;
  stats jsonb;
  metadata jsonb;
BEGIN
  SELECT count(*) INTO available FROM public.products WHERE is_available;
  IF available < 100 THEN RAISE EXCEPTION 'Restored backup has fewer than 100 available products'; END IF;
  SELECT public.platform_statistics(45), public.product_metadata() INTO stats, metadata;
  IF (stats->>'totalProducts')::integer <> available THEN
    RAISE EXCEPTION 'Restored statistics disagree with catalogue';
  END IF;
  IF jsonb_array_length(metadata->'categories') = 0 OR jsonb_array_length(metadata->'anime') = 0 THEN
    RAISE EXCEPTION 'Restored metadata is empty';
  END IF;
  IF EXISTS (SELECT FROM public.products WHERE price IS NULL OR price <= 0
      OR image_url IS NULL OR anime_name IS NULL OR units_sold IS NULL
      OR search_document IS NULL OR intelligent_score IS NULL) THEN
    RAISE EXCEPTION 'Restored catalogue has invalid product data';
  END IF;
  IF NOT EXISTS (SELECT FROM public.products WHERE search_document @@
      websearch_to_tsquery('simple', (SELECT anime_name FROM public.products WHERE is_available ORDER BY id LIMIT 1))) THEN
    RAISE EXCEPTION 'Restored full-text search returned no products';
  END IF;
END $$;
SELECT count(*) AS restored_products, count(*) FILTER (WHERE is_available) AS available_products FROM public.products;
SQL
echo 'Backup restored and checked successfully; disposable container will be removed.'