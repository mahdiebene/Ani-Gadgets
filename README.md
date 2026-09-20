# AnimeGadgetsHub

Anime merchandise discovery for Bangladesh: Daraz listings, prices in BDT, anime/category filters, and explainable demand-based ranking. No accounts, affiliate links or monetization.

## Stack

- React 18, Vite and Tailwind frontend; Express API on Node 22/24.
- Self-hosted PostgreSQL 17 and Express API using Docker Compose.
- Daraz catalogue JSON ingestion with bounded requests, retries, polite delays, normalization, anime matching, scoring and transactional upserts.
- Read-only API database role; separate ingestion writer; secrets stored outside the repository.
- Six-hour ingestion and daily local backups via systemd timers. Honest database/freshness health checks.

## Features

- Daraz merchandise with prices in BDT, anime/category filters and paginated search.
- Explainable 100-point ranking based on sales evidence, anime popularity, product appeal, value and first-seen recency.
- Transactional catalogue refreshes that preserve existing data on failure.
- Database and ingestion-freshness health checks.
- Responsive React interface with light and dark themes.

## Solo discovery and comparison

- Source-aware seller links and source filtering; existing Daraz ingestion is retained.
- Header search reaches Browse, and saved listing IDs persist on the same browser.
- Listing cards distinguish demand scores from authenticity, show observation freshness, and keep unknown prices explicit.
- A private local JSON CLI curates reviewed identities, merchants, offers and reference notes; default dry-run needs no database. No new scraper, paid API, seller outreach or account service.
- Read-only catalogue/detail pages compare complete, equivalent BDT offers while keeping deposits, missing costs, stale stock and foreign-currency estimates distinct.
- Saved-items page, browser-local price targets, observation history and a buying checklist. No background notification promises or authenticity guarantees.
- Restricted database roles and public-field projections preserve private notes and append-only observation history. Existing Daraz ingestion stays isolated and unchanged.
- A 100-product fictional demo and disposable PostgreSQL checker exercise the workflow without real suppliers or external requests.

Try it offline: build the frontend without a production API override, run `npm --prefix 'E:\ani-gadgets\backend' run demo`, then open `http://127.0.0.1:4173/#catalogue`. No database setup is needed for this demo.

Current roadmap: [Implementation plan](https://github.com/mahdiebene/Ani-Gadgets/blob/main/plan.md).
Migration and limitations: [Catalogue foundation](https://github.com/mahdiebene/Ani-Gadgets/blob/main/docs/catalogue-foundation.md).
Local commands, import format and operation: [Solo catalogue guide](https://github.com/mahdiebene/Ani-Gadgets/blob/main/docs/solo-catalogue.md).

Publishing these changes does not apply database migrations. Deploy schema, then API, then frontend; source filtering requires the matching `/api/products/meta/sources` endpoint. Production API configuration and live requests must be verified separately.

### Checks (PowerShell)

```powershell
npm --prefix 'E:\ani-gadgets\backend' test
npm --prefix 'E:\ani-gadgets\frontend' test
npm --prefix 'E:\ani-gadgets\frontend' run build
# Optional fixture-based browser check (Chrome/Chromium must be installed):
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm --prefix 'E:\ani-gadgets\frontend' run test:browser
```

Database integration tests are opt-in with `TEST_DATABASE=1` against a disposable, schema/role-provisioned PostgreSQL instance. No deployment or production migration is performed by these commands.

## License

MIT