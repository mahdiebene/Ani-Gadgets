# Production release — 2026-09-20

Application release: `272279d` on `main`. Public frontend: <https://www.anigadgetsbd.app/#catalogue>. Public API: <https://api.anigadgetsbd.app/health>.

## Deployment and validation

- Existing application directory: `/opt/anigadgets`. Release staging: `/opt/anigadgets-releases/20260920-solo`. No DNS, TLS proxy, database credentials or unrelated service changes.
- Backed up production before changes, restored the dump into a disposable isolated PostgreSQL 17 container, and verified 1,000 listings (999 available), required fields, aggregates and search.
- Ran all 42 backend tests, without skips, on **PostgreSQL 17.11** twice: once on a fresh database, once on the restored production backup. Both schema and role scripts were reapplied. Disposable databases had no production network, credentials or volume. No integration test ran against production.
- Applied additive schema, then restricted roles, then replaced only the API image. Full listing-row hash and counts were unchanged across migration. Temporarily paused and restored only the AnimeGadgets ingestion timer.
- Active API/ingestion image: `anigadgets-backend:solo-20260920`, also tagged `anigadgets-backend:local` for the existing Compose services.
- Pushed the application commit only after API validation. GitHub Actions passed and Vercel production deployment succeeded. Published JavaScript uses `https://api.anigadgetsbd.app/api`.
- Production Chrome smoke passed: real API/CORS, reviewed-catalogue empty state/reload, Daraz search/source filter, browser-local saves/reload/removal and mobile layout. Only GET requests to the frontend/API origins were allowed; seller resources were blocked.
- Production roles verified: reader cannot write listings or read private catalogue tables; Daraz writer retains ingestion privileges but cannot read catalogue views; neither is a curator/importer member. Curator/importer groups are NOLOGIN and nonadministrative.
- The running database container retained older file bind-mount inodes. This release applied the current host schema/grants over stdin, avoiding those stale mounts without restarting PostgreSQL. The provisioning script and disposable checker now use the same stdin migration method, with lock and statement timeouts, for future upgrades. First-time container initialization still uses the normal mounted files.
- Re-ran the restored-backup PostgreSQL 17 check using stdin migrations: all 42 tests passed, no skips, 1,000 restored listings preserved. Installed the corrected provisioning/check scripts; the full provisioning helper was not rerun against production.
- A normal post-deployment Daraz ingestion completed successfully at **18:11:29 UTC**, with 1,000 products processed across 50 requests and exit status 0. The existing request/product caps intentionally stopped enumeration (`truncated: true`), so no missing-listing reconciliation was attempted.
- After that refresh, production contained **1,011 total listings, 1,009 available**, with fresh API health. The reviewed catalogue and demo counts remained zero. Both scheduled timers were active; only the three normal AnimeGadgets API/database/TLS containers remained.

The production reviewed catalogue is intentionally empty. No fictional fixtures, seller inventory, legacy-title matches or supplier records were seeded. Use the private CLI with a separately provisioned restricted curator login for real manually reviewed entries; see `E:\ani-gadgets\docs\solo-catalogue.md`. Discover remains backed by existing Daraz listings.

## Retained rollback assets (root-only backup directory)

- `/var/backups/anigadgets/release-20260920-solo/database.dump` — pre-migration custom-format dump.
- `/var/backups/anigadgets/release-20260920-solo/source.tar.gz` — previous `/opt/anigadgets` source tree.
- `/var/backups/anigadgets/release-20260920-solo/image-id` — previous image identifier.
- `anigadgets-backend:pre-solo-20260920` — retained previous API/ingestion image.
- The same backup directory holds restore, build, PostgreSQL fresh/upgrade test, migration and production-verification logs.

These backups are on the same host, not off-host disaster recovery. The release subdirectory is not removed by the daily top-level 14-day dump retention. Retain it through the rollback window, then manage it explicitly.

## If rollback becomes necessary

Do not restore the dump over a live database merely to roll back code: that would discard later ingestion/curation. Leave additive tables, columns, views and observations in place. Never use `docker compose down -v`.

Coordinate a Vercel rollback to the preceding known production deployment with API rollback. The older API lacks the new catalogue and source endpoints; do not claim new features work after rollback. Do not run the older installer against the upgraded database.

On the server, first ensure ingestion is not running; then pause its timer, retag the retained image, and recreate **only** the API:

```sh
sudo systemctl is-active anigadgets-ingest.service
# If active/activating, wait for the current job to finish before continuing.
sudo systemctl stop anigadgets-ingest.timer
sudo docker tag anigadgets-backend:pre-solo-20260920 anigadgets-backend:local
sudo docker compose -f /opt/anigadgets/deploy/compose.yml up -d --no-deps --no-build api
sudo systemctl start anigadgets-ingest.timer
curl --fail-with-body https://api.anigadgetsbd.app/health
```

Keep the source archive for investigation/restoration to a separate directory. Production source currently reflects the new release, so an unreviewed rebuild after retagging would undo the image rollback. Recheck legacy listings, canonical frontend requests/CORS, API health and ingestion after any rollback. Do not alter other applications on the shared host.