#!/bin/bash
# Run as root from the deployed source tree. Never run with shell tracing (set -x).
set -euo pipefail
test "$(id -u)" = 0 || { echo 'Run with sudo.' >&2; exit 1; }
test -f /opt/anigadgets/deploy/compose.yml
docker compose version >/dev/null
# Normalize templates before copying them into runtime configuration.
find /opt/anigadgets/deploy -type f -exec sed -i 's/\r$//' {} +
install -d -m 0700 /etc/anigadgets /var/backups/anigadgets
if [ ! -f /etc/anigadgets/api.env ]; then
  install -m 0600 /opt/anigadgets/deploy/api.env.example /etc/anigadgets/api.env
fi
for name in db_admin_password db_reader_password db_writer_password; do
  if [ ! -s "/etc/anigadgets/$name" ]; then
    (umask 077; openssl rand -hex 32 > "/etc/anigadgets/$name")
  fi
  # Parent directory is root-only; files must be readable by container users.
  chmod 0444 "/etc/anigadgets/$name"
done
chmod 0755 /opt/anigadgets/deploy/init-db.sh /opt/anigadgets/deploy/backup.sh
docker compose -f /opt/anigadgets/deploy/compose.yml up -d --wait database
# Reapply migrations on upgrades too; no tables are dropped.
docker compose -f /opt/anigadgets/deploy/compose.yml exec -T database sh /docker-entrypoint-initdb.d/10-anigadgets.sh
docker compose -f /opt/anigadgets/deploy/compose.yml up -d --build api
install -m 0644 /opt/anigadgets/deploy/systemd/* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now anigadgets-ingest.timer anigadgets-backup.timer
echo 'Private backend installed. Public TLS/DNS routing must be configured separately.'