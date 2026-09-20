# Solo catalogue operator guide

## What this delivers

No paid service, external integration, outreach or account system is needed. The existing Daraz pipeline remains unchanged. The new path is **manually authored JSON → explicit review/publication → local CLI → read-only catalogue → comparison UI**. No import downloads URLs or images, seeds real suppliers, or claims a reviewed item is authentic. The older partner-feed proposal is retired; existing private permission fields are preserved but not used to pretend a manual record is a partner feed.

Database login and membership of a restricted PostgreSQL role protect curation. There is intentionally no HTTP admin endpoint, token in the browser, public write API, automatic match, currency feed, checkout, email or push service.

## Quick checks (Windows / PowerShell)

To try the complete UI without setting up a database, build the frontend with no production `VITE_API_URL` override, then run `npm --prefix 'E:\ani-gadgets\backend' run demo` and open `http://127.0.0.1:4173/#catalogue`. This loopback-only server uses 100 clearly fictional products in memory, serves the built frontend, and blocks automatic external requests with a content security policy. Nothing is persisted except your browser's saved IDs/targets. Use a separate browser profile if you do not want demo IDs mixed into your normal saved list. `-- --check` tests the demo then exits. Existing live listings are intentionally absent from this offline demo.

```powershell
npm --prefix 'E:\ani-gadgets\backend' run catalogue -- --demo --dry-run
npm --prefix 'E:\ani-gadgets\backend' test
npm --prefix 'E:\ani-gadgets\backend' run test:postgres
npm --prefix 'E:\ani-gadgets\frontend' test
npm --prefix 'E:\ani-gadgets\frontend' run build
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm --prefix 'E:\ani-gadgets\frontend' run test:browser
```

`test:postgres` creates its own password-protected cluster on a randomly selected loopback port, applies schema/roles twice, runs all database tests and applies a 100-product fictional demo through the CLI. It stops/removes the cluster afterward. It **does not use your existing database URL**. Default tools: `C:\Program Files\PostgreSQL\16\bin`; override `PG_BIN` for an installed version. Normal `npm test` skips database integration unless `TEST_DATABASE=1`; never opt in against a database you need to preserve, including production. Sequences advance even on rolled-back inserts.

## Setup and least privilege

1. Back up any existing database before upgrading. Apply `E:\ani-gadgets\backend\db\schema.sql` as owner with `psql -X -v ON_ERROR_STOP=1`. Changes are additive and transactional; reapplication is supported. There is no legacy backfill.
2. Apply `E:\ani-gadgets\deploy\roles.sql` in the existing PostgreSQL container. It reads the existing reader/writer password secret files and introduces two **NOLOGIN** group roles, requiring no new container secrets. Outside that container, provision existing reader/writer credentials securely and apply the equivalent grants; the disposable checker demonstrates this with ephemeral credentials, not production ones.
3. For local curation, use a dedicated login created by the database owner and grant it membership in `anigadgets_curator` and `anigadgets_importer`, plus CONNECT to your database. Set its password through a secure PostgreSQL prompt (`\password`) rather than placing it in source/history. For observation-only jobs, grant only `anigadgets_importer`. Never grant either role to the API reader or Daraz writer.
4. Configure the existing `DATABASE_URL` or `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD_FILE` mechanism for this login. The CLI explicitly `SET LOCAL ROLE`s to the appropriate restricted group role inside each transaction. No owner credentials are required for ordinary imports.

The reader still cannot SELECT private base tables, even though it can read the four explicitly allowlisted public views. The Daraz writer cannot access those views. Both importer and curator have only SELECT/INSERT on observations, no UPDATE/DELETE/TRUNCATE. The owner remains capable of maintenance and is not an application role. SQL owners are trusted; grants are not protection against a malicious database administrator.

## File format

UTF-8 JSON, at most 2 MiB, version 1. Unknown fields are rejected. Maximum 1,000 rows per section and 3,000 total records. Stable keys are lowercase letters/digits/`-`/`_`, at most 100 characters. Dates use ISO UTC (`2026-09-20T10:00:00Z`); monetary values are nonnegative JSON numbers with at most two decimal places. Null means unknown, **not zero**. All amounts in one observation use the stated currency. HTTP(S) links must not contain credentials. Links are never fetched during import.

Generate a complete fictional example without a database:

```powershell
node 'E:\ani-gadgets\backend\src\catalogue\cli.js' --print-demo |
  Set-Content -Encoding UTF8 "$env:TEMP\catalogue-demo.json"
npm --prefix 'E:\ani-gadgets\backend' run catalogue -- --file "$env:TEMP\catalogue-demo.json" --dry-run
```

Document envelope:

- `version`: `1`.
- `mode`: `curation` or `observations`.
- `reviewer`: required text for curation; private, never returned by the public API.
- `products`, `merchants`, `offers`, `observations`, `evidence`: arrays; omitted sections mean **unchanged**, not delete.

Required row fields:

| Section | Required fields |
| --- | --- |
| products | `key`, `name`, `category`, `reviewed`, `published`, `is_demo`; reviewed records also need `identity_reference_url` |
| merchants | `key`, `name`, `published` |
| offers | `key`, `product` key, `merchant` key, `listing_url`, `condition`, `purchase_route`, `reviewed`, `published` |
| observations | `offer` key, `observed_at`, `expires_at`, `source_reference`, `currency`, `price_kind`, `availability` |
| evidence | `key`, exactly one of `product`/`offer` keys, `evidence_type`, `source_url`, `summary`, `captured_at`, `reviewed` |

Optional product identity fields: `anime_name`, `manufacturer`, `product_line`, `manufacturer_code`, `isbn`, `edition`, `variant`, `scale`, `language`, `volume`.

Optional merchant fields: `website_url`, `country_code` (two uppercase letters), `payment_policy_url`, `delivery_policy_url`, `return_policy_url`.

Offers: `included_parts` describes the exact parts set. Condition is `unknown`, `new`, `used`, `damaged`; route is `unknown`, `local`, `direct_import`, `proxy`, `request`. Publication requires explicit review, but incomplete offers are still displayed honestly and excluded from total ranking.

Observations: `price_kind` is `unknown`, `full` (requires `full_price`) or `deposit` (requires `deposit_amount`). Optional `full_price`, `deposit_amount`, `shipping_amount`, `tax_amount`, `fee_amount`, `ships_to_bangladesh`, `delivery_destination`, `preorder_release_at`, `preorder_terms`. Deposit cannot exceed a known full price. Shipping, including zero shipping, requires a destination. `availability`: `unknown`, `in_stock`, `out_of_stock`, `preorder`, `discontinued`. Observations cannot be in the future; expiry must follow observation time. Expired records remain useful history but cannot rank as a current quote.

Evidence types are `seller_claim`, `manufacturer_reference`, `independent_review`; optional `expires_at`. Reviewed current references are displayed with type/date/scope. Source/review fields and existing permission references remain private; public summaries must contain only text you intend to publish. Evidence is not an authenticity verdict.

## Validate, apply, update and unpublish

Default is validation only, with **no database connection or writes**. Structural validation cannot know whether a referenced key already exists or conflicts with a stored record; those checks happen inside the apply transaction.

```powershell
npm --prefix 'E:\ani-gadgets\backend' run catalogue -- --file 'E:\ani-gadgets\local-catalogue.json' --dry-run
# With the restricted database login configured:
npm --prefix 'E:\ani-gadgets\backend' run catalogue -- --file 'E:\ani-gadgets\local-catalogue.json' --apply
```

Every supplied row replaces its mutable fields; retain all identity/offer attributes when updating. Omitted rows remain unchanged. Reapplying the same observation `(offer, observed_at)` is a no-op only when all values match. Different values at the same timestamp reject the **entire transaction**. Corrections append a new timestamp. A failed row rolls back all writes; another import in progress fails fast.

Identity attributes and an offer's identity/merchant/URL/condition/parts/route cannot be remapped through the CLI because doing so would relabel its history. For a mistaken match/identity, set the old record's `published` to `false`, retain its original attributes, and create a new key. Product display names, review/reference information, merchant policy information and publication can be updated. The curator is trusted and its SQL membership must remain private.

To hide a product, merchant or offer, apply its full original row with `published: false`. Views immediately hide dependent offers, references and history on the next request. No deleting or mutating historical observations is necessary. To withdraw a reference, apply its row with `reviewed: false`. There is no server response cache; an already open browser still needs Refresh to pick up manual withdrawals.

For observation-only import use `mode: observations` and only `observations`. Existing stable offer keys must exist. This mode cannot curate identities, publish offers, or rewrite history.

Demo writes require an additional `CATALOGUE_ALLOW_DEMO=1` and should only target a disposable **local** database. Demo entries remain visibly labelled fictional. Never use them as real shop inventory. The flag is an intentional operator opt-in, not an environment attestation.

## API and UI semantics

- `GET /api/catalogue?search=...&category=...&limit=20&offset=0`: published reviewed identities, stable ID pagination, maximum limit 100. Search matches names/anime/codes/ISBN as literal text; SQL is parameterized.
- `GET /api/catalogue/:id`: published identity, reviewed published offers from published merchants, reviewed nonexpired reference notes and latest 20 observations per offer.
- Private `reviewed_by`, permission flags/references, curation keys and observation source notes are excluded in SQL, not merely hidden by React.
- `#catalogue`, `#catalogue/:id`, `#saved` support reload and browser back. Existing discovery remains available separately.
- Complete totals require full BDT prices, all four known amounts, fresh observation/expiry, in-stock status, Bangladesh delivery/destination, known condition/parts/route and a safe listing URL. Zero is a known cost, null is unknown.
- A lowest label needs two or more offers for the same identity, condition, exact parts text, route and exact destination. Exact text matching is deliberately conservative. Deposits, foreign currency, preorders, stale stock and unknown costs never win a label.
- The manual FX calculator needs an operator-entered positive rate/date and all four known amounts. It shows an estimate, not a quote, and never changes seller ranking.
- Saved IDs and price targets live only in this browser. Targets compare eligible totals when a page loads or Refresh is pressed. They are not background alerts. Check the offer's condition and destination before interpreting a target match.

## Upgrade and rollback

Apply schema and grants first, API second, frontend last. Preserve existing production credentials and Daraz ingestion settings. Verify legacy listing endpoints and new catalogue reads with the reader login. The frontend tolerates an unavailable catalogue/source endpoint without pretending it contains an empty successful catalogue or discarding working category filters.

On the Linux Docker host, `sudo bash /absolute/release/deploy/check-postgres.sh <built-release-image> [absolute-backup-path]` runs all backend tests against a disposable PostgreSQL 17 container. With a backup it tests the actual upgrade path; without one it tests a fresh database. Schema and grants are applied twice. The container has no published ports, production volumes, production credentials or external network. The test process shares only its isolated network namespace. Production integration tests remain prohibited; use `/opt/anigadgets/deploy/verify.sh` for read-only live checks instead.

After publication, set `CHROME_PATH` and run `node 'E:\ani-gadgets\frontend\scripts\production-smoke.mjs'`. Unlike the fixture smoke, this explicit operator check reads the real `https://www.anigadgetsbd.app` frontend and `https://api.anigadgetsbd.app` API. It allows only GET requests to those two origins, blocks third-party resources, and uses a disposable browser profile for saved-item checks. It never purchases, follows seller links or writes to the server.

Rollback API/frontend together if needed; leave additive columns/views/history intact. Never drop populated tables to roll back code. Revoking the reader's new view grants disables catalogue reads without touching legacy listing access. No production migration, hosting configuration or live compatibility is established by local validation alone.