# Finish AnimeGadgetsHub (Ani-Gadgets)

> Status: agreed plan, not yet implemented. Audited and written 2026-09-20.
> Supersedes the aspirational `EXECUTION-PLAN.md` and `strategic-roadmap.md`.

## Context

The repo looks nearly finished — polished React UI, deployed frontend at `anigadgetsbd.app`, live Express API on Render, 2,400 lines of backend logic, and 2,000+ lines of roadmap docs. It is not. **The product's data layer does not work, and the site has never shown a single product.**

Verified live, 2026-09-20:

| Check | Result |
|---|---|
| `anigadgetsbd.app` | 200 — frontend serves fine |
| `animegadgets-api.onrender.com/health` | 200 `{"status":"ok"}` |
| `/api/products`, `/api/anime`, `/api/products/meta/categories` | **500 `TypeError: fetch failed`** |
| `/api/stats` | 200 `{"totalProducts":0,...}` |

Every endpoint that touches the database fails: the backend cannot reach Supabase at all (project paused on free tier, or wrong env var on Render). `/health` still reports `ok` because it never touches the DB, and `/api/stats` reports a cheerful `totalProducts: 0` because `routes/stats.js` destructures `{ count }` without ever checking `error` — so **a total database outage is indistinguishable from an empty database** to any monitor you attach.

Underneath that, the ingestion pipeline that was supposed to fill the database doesn't exist and couldn't run if it did:

- `backend/package.json:10-29` defines ten npm scripts pointing at `src/bot/*.js`. **There is no `src/bot/` directory** — and `git log --all` confirms there never was one in any of the 7 commits. The scripts were written for files that were never created, so there is nothing to recover.
- `services/scraperService.js:1-2` requires `puppeteer` and `cheerio`; `services/trendingAnimeService.js:1` requires `axios`. **None of the three are in `package.json` dependencies** — these modules throw on `require`. Commit `118c205` removed exactly those three to get Render deploying, leaving every service that imports them dead.
- `scraperService.js:283` calls `createAnimePriorityMap()`, which is never defined or imported. Dead on the first call regardless.
- Its cheerio selectors (`[data-qa-locator="product-item"]`, `.ooOxS`, `.RfADt`) parse server-rendered HTML that **Daraz no longer emits** — search is now a client-side React SPA. I fetched the page: 57 KB, zero product markers.

So: the goal is not to polish a finished product. It is to build the data pipeline that was always missing, reconnect the database, and fix the correctness bugs that were hidden by there never having been any data to expose them.

### The finding that changes the plan

Daraz still serves a clean JSON endpoint:

```
GET https://www.daraz.com.bd/catalog/?ajax=true&q=anime+figure&page=2
→ 200 application/json
  mods.listItems[]  — 40 products
  mainInfo          — { totalResults: 4080, pageSize: 40, page: 2 }
```

Each item arrives pre-parsed, with fields that map almost 1:1 onto the database:

```
name, itemId, itemUrl, image, price (numeric), originalPrice (numeric),
discount ("63% Off"), ratingScore (float), review (int), inStock (bool),
sellerName, brandName, location ("Dhaka" | "Overseas"), itemSoldCntShow ("424 sold")
```

**This removes Puppeteer from the project entirely.** No headless Chrome, no 300 MB download in CI, no browser fingerprinting fight, no CSS selectors to rot. The scraper becomes an HTTP client that parses JSON — it runs in a GitHub Actions job in seconds, and it breaks only if Daraz removes the endpoint (at which point Puppeteer returns as a documented fallback, hitting this same parser).

It also unlocks signals the current scorer never had. `itemSoldCntShow` is **actual units sold** — the "sales velocity" layer the roadmap describes at length and the code never implemented. `location` distinguishes Dhaka stock (days) from Overseas (weeks), which matters more to a Bangladeshi buyer than any trending score.

### Scope

**In:** working data pipeline · real URLs and product pages · SEO · free-tier hosting with the failure modes mitigated in code.

**Out:** affiliate links and all monetization (not monetizing — the outbound-link helper is a 10-line change if that ever changes) · user accounts · wishlist · price alerts · premium tier · Reddit/community signals · multi-source scrapers.

---

## Phase 0 — Get the database back (blocks everything)

Nothing below can be tested until the API can reach Supabase. No schema definition exists anywhere in the repo — the `CREATE TABLE` statements in `EXECUTION-PLAN.md:134-174` are prose in a markdown file, and **they don't match the code**: the docs define `anime_title` and `anime_id`, while the API queries `anime_name`; the docs have no `category` column although the API filters and groups by it; no `intelligent_score` column although it's the default sort field.

1. Diagnose the Supabase project — paused free-tier project (resume it) vs. wrong `SUPABASE_URL`/`SUPABASE_ANON_KEY` on Render. *Requires a look at the Supabase dashboard.*
2. **Create `backend/db/schema.sql`** — the first runnable schema this project has ever had. Reconstructed from actual code usage, not from the docs. Covers `products` and `trending_anime`, with `intelligent_score`, `category`, `anime_name`, `score_breakdown jsonb`, plus new columns for the Daraz signals: `units_sold int`, `seller_name text`, `location text`, `in_stock bool`, `daraz_item_id bigint`.
3. Indexes on `(intelligent_score desc)`, `(category)`, `(anime_name)`, `(is_available)`, unique on `product_url`.
4. Enable RLS with an anon-read-only policy. The backend uses the **anon** key (`db/supabase.js:5`) — without RLS, anyone who obtains that key can write to your tables. (Good news: the full git history was scanned — `.env` was never committed and no keys have ever leaked. This is about keeping it that way.)
5. `backend/db/README.md`: how to apply it.

## Phase 1 — Backend correctness

These are all masked by the empty database and would surface as soon as data arrives.

- **`routes/stats.js`** — check `error` on every query (currently swallowed, producing the fake-healthy response above). Lines 29 and 37 select `anime_title`/`anime_id`, which **nothing ever writes**, so `topAnimeByProducts` is permanently `[]`; switch to `anime_name`. The `>= 60` threshold here contradicts the scorer's own `>= 45` cutoff.
- **`routes/anime.js:58`** — `/:malId/products` filters on `anime_id`, never populated → always empty. Join on `anime_name` or populate `anime_id` at ingest.
- **`routes/products.js:123`** — `search` is interpolated raw into a PostgREST `.or()` filter string. A comma or parenthesis in the query corrupts the filter; this is filter injection. Escape it, or use `.textSearch()`.
- **`routes/products.js:149`** — `limit` is unbounded; cap at 100.
- **`routes/products.js:8-45`** — `/meta/categories` and `/meta/anime` select *every* row to compute a distinct list. PostgREST silently caps at 1000 rows, so both lists go **quietly wrong** once the table exceeds 1000 products. Replace with an RPC or a materialized view.
- **`index.js:56`** — `origin.endsWith('anigadgetsbd.app')` also matches `evil-anigadgetsbd.app`. Match the host exactly.
- **`index.js:159`** — the 404 handler is registered *after* the error middleware; verify it's reachable.
- **`index.js:13-40`** — the rate-limit `Map` is never pruned (unbounded growth), and behind Render's proxy `req.ip` is the proxy for every client unless `app.set('trust proxy', 1)`.
- **`/health`** should actually check Supabase, so monitoring reflects reality.
- Routes return raw `error.message` to clients, leaking Postgres internals. Log server-side, return a generic message.

## Phase 2 — The scraper (the actual missing product)

New `backend/src/ingest/`, replacing the phantom `src/bot/`:

- **`darazClient.js`** — `GET /catalog/?ajax=true&q=…&page=…`, parse `mods.listItems`, page via `mainInfo.totalResults`. Retry with backoff, a real User-Agent, polite delay between requests, and a hard cap per run.
- **`normalize.js`** — Daraz item → DB row. `itemUrl` is protocol-relative (`//www.daraz.com.bd/…`) and needs an `https:` prefix; `itemSoldCntShow` ("424 sold") parses to `units_sold`.
- **`animeMatcher.js`** — replaces `detectAnimeFromProductName` in `config/bdAnimeConfig.js:225`, which has a **serious bug**: Death Note's character list includes `'L'`, and the check is `nameLower.includes('l')` — so nearly every product that doesn't match an earlier anime gets tagged *Death Note*. `'Ace'` matches "brac**ace**let", `'Gon'` matches "dra**gon**", `'Law'`, `'Power'`, `'Bond'` are all substrings of common words. Fix with word-boundary matching and a minimum token length. **`bdAnimeConfig.js`'s 20-anime dataset is the best asset in the backend — keep the data, replace the matcher.**
- **`run.js`** — orchestrates keyword sweep → normalize → match → score → upsert on `product_url`; marks rows not seen this run as `is_available = false`.
- **`.github/workflows/scrape.yml`** — cron every 6h + manual trigger. Free, and it keeps Supabase active, which prevents the free-tier pause that plausibly caused the current outage.
- Add `undici`/`axios` to dependencies; **delete the ten dangling bot scripts** from `package.json`.

`services/scraperService.js` is deleted — its Daraz parsing is obsolete and its DB-write logic moves to `ingest/`.

## Phase 3 — One scoring algorithm

Three formulas currently exist and **none agree**:

| Source | Weights | Display cutoff |
|---|---|---|
| `README.md:81-87` | 50 / 35 / 15 | 60 |
| `strategic-roadmap.md:210-218` | 35 / 30 / 20 / 10 / 5 | 60 |
| `intelligentScorerService.js:45-51` | 40 / 25 / 15 / 15 / 5 | **45** |

Keep `intelligentScorerService.js` (the real one, and the best-reasoned), **delete `scorerService.js`** (superseded legacy), and fold in the new signals — `units_sold` as the primary demand input it was always meant to have, `in_stock`, and Dhaka-vs-Overseas. Then make the docs match the code, rather than the reverse.

One trap to fix: `calculateFreshnessScore` scores on `scraped_at`, and `markStaleProducts` flips `is_available=false` after 72h. If the cron ever stops, **every product decays and the site empties itself silently.** Score freshness on *first seen*, not *last scraped*, and alert when the newest row ages past ~12h.

## Phase 4 — Frontend: real URLs, product pages, SEO

The app has no router — `App.jsx:16` switches views with `useState('home'|'browse')`. Nothing is linkable: no product URL, no category URL, no shareable search, and the browser back button leaves the site. For an SEO-driven project this is fatal, and it's the single highest-leverage frontend change.

- **`react-router-dom`** with `/`, `/browse`, `/product/:id`, `/anime/:slug`, `/category/:slug`. `App.jsx`'s handlers become navigation; `HomePage`/`BrowsePage` stay largely as-is. Filters and pagination move into the query string.
- **Product detail page** — doesn't exist today. `fetchProduct(id)` in `utils/api.js:84` is already written and unused; `GET /api/products/:id` already works. Needs the page, the score breakdown UI (`score_breakdown` jsonb is already produced), and "more from this anime".
- **Fix pagination — one line.** `utils/api.js:64` reads `data.total || data.count`, but the API returns `data.pagination.total` (`routes/products.js:158-162`). `total` is therefore always `undefined`, so `totalPages` is always 1 and `BrowsePage.jsx:91` permanently reads "20 products found". Pagination has never worked.
- **Remove the fake wishlist** — `ProductCard.jsx:7,37-49` is `useState` that persists nothing. It promises a feature that doesn't exist. (No accounts in scope, so no real wishlist either.)
- **SEO**: per-route `<title>`/meta/OG via `react-helmet-async`, `sitemap.xml`, `robots.txt`, JSON-LD `Product` schema. Note the ceiling honestly: this is a client-rendered SPA, so crawlers see an empty shell on first paint. Good meta tags get you most of the way; if organic search becomes the priority, SSR/prerendering is a later, larger change.
- **Cold-start UX**: `HomePage.jsx:45-108` fires up to 13 API calls on load. Against a cold Render instance that's a 30-60s blank page. Collapse to one `/api/products/homepage` call, and show a real "waking up" state instead of an indefinite skeleton.
- Empty state currently says "No products yet" even when the API is *down* — distinguish "no results" from "backend unreachable".

## Phase 5 — Operations (free tier, mitigated)

- **Keep-alive** — GitHub Actions cron pinging `/health` every ~10 min so Render doesn't spin down; the 6h scrape doubles as the Supabase keep-alive that prevents the free-tier pause.
- **Honest health check** (Phase 1) + an uptime monitor pointed at it, so the current failure mode — API green, database gone — cannot recur silently.
- Scrape failures should fail the Actions run loudly rather than silently leaving stale data.
- `.env.example` for both apps updated to match what the code actually reads.

## Phase 6 — Docs

`EXECUTION-PLAN.md` and `strategic-roadmap.md` describe a 20-week, 950k-BDT/month business that doesn't exist. Archive them under `docs/` rather than deleting — they're aspirational, not current. Rewrite `README.md` to describe what the thing does, how to run it, and the real schema/scoring (and fix its duplicated `MIT` line, `README.md:91-93`).

---

## Verification

Each phase is checkable end to end:

1. **Phase 0** — `curl .../api/products?limit=3` returns `200` with `[]` instead of `500`. Schema applies cleanly to a fresh Supabase project.
2. **Phase 2** — run `npm run ingest` locally; assert ≥100 rows land in `products` with non-null `price`, `image_url`, `anime_name`, `units_sold`. Spot-check 10 rows against the live Daraz listing for accuracy, and confirm the `'L'`→Death Note misclassification is gone.
3. **Phase 3** — unit tests on the scorer: a 0-review product must not outrank a 400-sold product; a stale row must not silently vanish.
4. **Phase 4** — `npm run dev`, then **drive it in a browser**: load `/`, click into a product, copy the URL, reload it cold, hit back, resize to 375px. Confirm page 2 of `/browse` shows different products than page 1 (proves the pagination fix). Check `<title>` and OG tags per route with view-source.
5. **Phase 5** — stop the backend; confirm the frontend shows "backend unreachable", not "No products yet". Confirm `/health` goes red when Supabase is unreachable.
6. **End to end** — trigger the Actions workflow manually, then load `anigadgetsbd.app` and see products that weren't there an hour earlier.

## Risks

- **Daraz removes `?ajax=true`.** Mitigation: the parser is isolated behind `darazClient.js`, so the Puppeteer fallback swaps in without touching normalize/score/upsert.
- **Datacenter IPs get challenged.** GitHub Actions runners may see anti-bot responses that a residential IP didn't. Detect explicitly (empty `listItems` on a query with `totalResults > 0`) and fail loudly. Fallback: run the scrape from a local machine on a schedule.
- **Scraping ToS.** Daraz's terms don't welcome automated collection. Staying polite (low rate, caching, cron not continuous) keeps this low-risk for a non-commercial site — and with no monetization, the exposure is small. Worth knowing, not worth stopping for.
- **The old Supabase project may not be recoverable.** If it's deleted rather than paused, Phase 0 becomes "create fresh" — no data lost, since there was none.

## Open item

Phase 0 needs a look at the Supabase dashboard (is the project paused, or are Render's env vars wrong?). Everything else can be done and verified from the codebase.
