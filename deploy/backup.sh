#!/bin/bash
set -euo pipefail
umask 077
directory=/var/backups/anigadgets
install -d -m 0700 "$directory"
file="$directory/$(date -u +%Y%m%dT%H%M%SZ).dump"
trap 'rm -f "$file.partial"' EXIT
docker compose -f /opt/anigadgets/deploy/compose.yml exec -T database \
  pg_dump -U anigadgets_owner -d anigadgets -Fc > "$file.partial"
test -s "$file.partial"
mv "$file.partial" "$file"
find "$directory" -maxdepth 1 -name '*.dump' -mtime +14 -delete
echo 'Database backup completed.'