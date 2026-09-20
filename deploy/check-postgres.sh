#!/bin/bash
# Validate a release against disposable PostgreSQL 17, optionally restoring a backup.
# Never attaches production volumes, credentials or networks; never publishes ports.
set -euo pipefail
test "$(id -u)" = 0 || { echo 'Run with sudo.' >&2; exit 1; }
if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo 'Usage: sudo bash /absolute/release/deploy/check-postgres.sh <built-image> [backup.dump]' >&2
  exit 1
fi
image=$1
root=$(cd "$(dirname "$0")/.." && pwd)
test -s "$root/backend/db/schema.sql"
test -s "$root/deploy/roles.sql"
docker image inspect "$image" >/dev/null
if [ "$#" = 2 ]; then test -s "$2"; fi
container=
cleanup() {
  if [ -n "$container" ]; then docker rm -fv "$container" >/dev/null; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Trust is confined to this throwaway container's isolated network namespace.
# The test process shares only that namespace, never the production Docker network.
container=$(docker run -d --pull=never --name "anigadgets-pg17-check-$$" \
  --network none --memory 512m --cpus 1 \
  --tmpfs /var/lib/postgresql/data:rw,size=512m \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=anigadgets \
  -e POSTGRES_USER=anigadgets_owner postgres:17-bookworm)
ready=false
for attempt in {1..60}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U anigadgets_owner -d anigadgets >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
test "$ready" = true || { echo 'Disposable database did not become ready.' >&2; exit 1; }
if [ "$#" = 2 ]; then
  docker exec -i "$container" pg_restore -U anigadgets_owner -d anigadgets \
    --no-owner --no-acl --exit-on-error < "$2"
fi
docker exec "$container" sh -c 'mkdir -p /run/secrets; printf "%s" disposable-test-only > /run/secrets/db_reader_password; printf "%s" disposable-test-only > /run/secrets/db_writer_password'
docker cp "$root/backend/db/schema.sql" "$container:/tmp/schema.sql"
docker cp "$root/deploy/roles.sql" "$container:/tmp/roles.sql"
for attempt in 1 2; do
  docker exec "$container" psql -X -U anigadgets_owner -d anigadgets -v ON_ERROR_STOP=1 -f /tmp/schema.sql
  docker exec "$container" psql -X -U anigadgets_owner -d anigadgets -v ON_ERROR_STOP=1 -f /tmp/roles.sql
done
docker run --rm --pull=never --network "container:$container" --memory 512m --cpus 1 \
  --read-only --tmpfs /tmp:rw,size=32m --cap-drop ALL --security-opt no-new-privileges:true \
  -e PGHOST=127.0.0.1 -e PGDATABASE=anigadgets -e PGUSER=anigadgets_owner \
  -e PGPASSWORD=disposable-test-only -e TEST_DATABASE=1 "$image" node --test
docker exec "$container" psql -X -U anigadgets_owner -d anigadgets -v ON_ERROR_STOP=1 \
  -c 'SELECT version(); SELECT count(*) AS preserved_listings FROM public.products;'
echo 'Disposable PostgreSQL 17 release check passed; container will be removed.'