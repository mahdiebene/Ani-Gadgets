# AnimeGadgets deployment operations

Existing installation: `/opt/anigadgets`. Runtime secrets: `/etc/anigadgets`. Backups: `/var/backups/anigadgets`. Do not change unrelated applications, ports, proxies or volumes on the shared server.

See `E:\ani-gadgets\docs\production-release.md` for the deployed release, verified backup and retained rollback image. See `E:\ani-gadgets\docs\solo-catalogue.md` for private curation and publication.

## Safe upgrade order

1. Back up production with `/opt/anigadgets/deploy/backup.sh`; verify the dump using `/opt/anigadgets/deploy/verify-backup.sh` in an isolated container.
2. Stage the new source separately and build a separately tagged image. Run `/absolute/release/deploy/check-postgres.sh <image> [absolute-backup-path]` as root for disposable PostgreSQL 17 validation. Never set `TEST_DATABASE=1` against production.
3. Preserve the previous source and image. Ensure ingestion is idle and pause its timer briefly. Stream the current schema and grants into the database with `psql -X -v ON_ERROR_STOP=1` and lock/statement timeouts. Do not rely on a running container's old bind-mounted files.
4. Deploy only the API container after schema/grants pass; restore the ingestion timer even on failure. Preserve all production credentials, database volumes and proxy settings.
5. Run `/opt/anigadgets/deploy/verify.sh`. It skips integration tests and checks live API and restricted reader access without inserting fixtures. Do not use an older verifier that runs integration fixtures on production.
6. Publish the frontend with `VITE_API_URL=https://api.anigadgetsbd.app/api`, then explicitly run the production browser smoke. A Git push alone does not migrate the backend.

`/opt/anigadgets/deploy/provision.sh` is an installation/update helper, not a substitute for a backup, isolated rehearsal or coordinated deployment. It now streams current host migration files to avoid stale Docker bind-mount inodes. Never run `docker compose down -v` as an update or code rollback.

## Read-only monitoring

```sh
sudo docker compose -f /opt/anigadgets/deploy/compose.yml ps
sudo systemctl list-timers 'anigadgets-*' --no-pager
sudo journalctl -u anigadgets-ingest.service --no-pager -n 30
curl --fail-with-body https://api.anigadgetsbd.app/health
```

No production fixtures or demo import. Backups on this host are not off-host disaster recovery. Never print secret files or full container environment blocks, enable shell tracing around credentials, or commit dumps/keys.