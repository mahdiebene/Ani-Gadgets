# Bangladesh anime merchandise discovery and comparison

Approved direction: evolve AnimeGadgetsHub beyond Daraz without replacing the existing stack.
Started: 2026-09-20. This is the current implementation plan; older roadmaps are historical proposals, not evidence of delivered features or validated demand.

## Product promise

Help Bangladesh buyers identify an exact product, find relevant purchase routes, inspect sourcing evidence, and compare genuinely comparable offers. Keep affordable merchandise alongside collector items. Price, popularity, seller claims, and a manufacturer reference alone do not establish authenticity.

## Guardrails

- Retain React/Vite/Tailwind, Express, PostgreSQL, and the existing Daraz pipeline.
- Keep legacy `products` as listings during migration. Never automatically merge listings by title or turn them into reviewed catalogue identities.
- Separate product identity, merchant, offer, observation history, and evidence. Edition, variant, condition, and included parts matter when comparing offers.
- Unknown costs remain null. A deposit is not a full price. Only comparable currencies, delivery destinations, and complete cost components can yield a landed total.
- Source permission and image permission are separate. Public accessibility or affiliate participation does not establish reuse rights. No new scraper or partner claim without approval and documented permission.
- Seller claims, manufacturer references, and independent reviews remain distinguishable. No blanket “verified authentic” badge.
- Initial implementation was local-only. The user subsequently authorized committing and pushing to `main`, including any configured automatic deployment. Production database migration and Vercel configuration changes remain separate operations.

## Phase 1 — Working discovery foundation (current implementation)

- [x] Reinspect repository and reproduce the search, wishlist, CTA, and ranking limitations.
- [x] Run baseline backend/frontend tests.
- [x] Pass submitted header searches to Browse; reset pagination/filters on each navigation and ignore obsolete responses.
- [x] Persist saved listing IDs on this browser, synchronize cards/tabs, and tolerate unavailable or corrupt storage. This is not account sync or a full saved-items page.
- [x] Replace hardcoded Daraz CTAs with source/seller-aware, safe outbound links.
- [x] Show last observation time and explicit price/authenticity/delivery uncertainty. Label the existing score as demand, not trust.
- [x] Filter existing listings by source end to end (SQL, API metadata, frontend).
- [x] Add regression tests; run both suites and the frontend production build.

Acceptance: old Daraz data still works; a non-Daraz listing is not labelled Daraz; unknown price is not zero; repeated searches start fresh; saving survives reload when storage is available; malformed source filters never become SQL.

## Phase 2 — Additive catalogue model (schema foundation now; activation later)

- [x] Add `catalogue_products`, `merchants`, `offers`, `offer_observations`, and `evidence_records` without altering listing IDs or ingestion semantics.
- [x] Encode explicit identity review, separate permission records, nullable full/deposit/cost amounts, purchase routes, availability and stock expiry.
- [x] Protect curated tables/history from both existing runtime roles (owner-only foundation).
- [x] Add database integration coverage and migration/rollback instructions.
- [ ] Grant an eventual dedicated importer insert-only observation access; no runtime catalogue writer exists yet.
- [ ] Before activation: implement an authenticated/restricted curation workflow and permission-gated partner import with dry-run validation and transactional observation writes.
- [ ] Before activation: review identity matches and conditions/parts before backfilling links or publishing comparisons. Do not seed unverified suppliers.

Acceptance for the schema slice: schema is additive/reapplicable, enforces relationships and monetary invariants, and grants no new catalogue write access to the public API or Daraz writer. The existing API continues to read legacy listings; an empty new schema is not a live comparison service.

## Phase 3 — Validate demand and acquire permissioned supply

- [ ] Interview approximately five collectors, five casual/gift buyers, and three–five sellers; record actual problems, budgets, and purchase journeys.
- [ ] Seek two willing catalogue partners, including one supplying manufacturer-identified merchandise. No manufacturer-authorized Bangladesh supplier has yet been independently established.
- [ ] Revalidate candidates: Knock, ThePoysha, Rokomari, Paperboat. Treat Good Smile, HobbyLink Japan, and Solaris Japan as potential reference/import sources, not confirmed Bangladesh fulfilment partners.
- [ ] Recheck primary terms before collection, including reported Solaris scraping restrictions and Meta authorization requirements.
- [ ] Document data/image permissions, permitted fields, expiry/revocation, provenance, update cadence, stale-stock policy, and payment/delivery/return policies.
- [ ] Confirm item-specific Bangladesh shipping eligibility, deposits, balance due, refund terms, dispatch estimates and import responsibility.

Gate: seller cooperation and legal reuse rights are real dependencies, not coding tasks that can be assumed complete. If reliable supply is unavailable, start with buying guides and moderated product requests.

## Phase 4 — Reviewed comparison pilot

- [ ] Curate roughly 100–150 figures and manga products; distinguish product line, manufacturer code/ISBN, edition, variant, language and volume.
- [ ] Add product detail/offer comparison routes and evidence inspection. Keep uncertain matches outside the comparison group.
- [ ] Show full price vs deposit, stock state, last checked/expiry, local/import/proxy routes, delivery eligibility, returns and evidence limitations.
- [ ] Display BDT landed estimates only with explicit exchange-rate timestamps and shipping/tax/fee assumptions; do not rank incomplete totals as cheapest.
- [ ] Separate discovery relevance, demand signals, identity completeness, evidence quality and offer completeness. Do not apply the Daraz demand cap or low-price bonus to specialist/pre-order eligibility.
- [ ] Measure useful outbound visits, incorrect matches, stale offers, search failures and user feedback before expansion.
- [ ] Add a saved-items page, alerts and additional approved sources only after the pilot is useful and maintainable.

## Deployment gate

- [ ] Reconfirm Vercel Production `VITE_API_URL=https://api.anigadgetsbd.app/api` and redeploy when authorized.
- [ ] Inspect the published bundle and real product requests/CORS; backend health alone does not verify the frontend cutover.
- [ ] Back up PostgreSQL; validate the schema twice on disposable PostgreSQL; apply schema and role grants as owner in staging before production.
- [ ] Verify old ingestion, API routes, source filtering, search, saved-state persistence and mobile/touch accessibility against staging.

## Validation commands (PowerShell)

```powershell
npm --prefix 'E:\ani-gadgets\backend' test
npm --prefix 'E:\ani-gadgets\frontend' test
npm --prefix 'E:\ani-gadgets\frontend' run build
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm --prefix 'E:\ani-gadgets\frontend' run test:browser
git -C 'E:\ani-gadgets' diff --check
```

The PostgreSQL tests require `TEST_DATABASE=1` and an isolated database configured through the existing PG environment variables. Never aim tests at production. Record skipped checks explicitly.

## Implementation log

- Baseline: clean `main` at `79ed518`, one commit ahead of `origin/main`; no push performed.
- Baseline validation: backend 30 passed / 1 PostgreSQL test skipped; frontend 3 passed. Node 24 is available. Neither `psql` nor Docker was found on PATH.
- Local implementation: Phase 1 complete; Phase 2 schema foundation complete. Migration/rollback details are in `E:\ani-gadgets\docs\catalogue-foundation.md`.
- PostgreSQL 16 was subsequently found at `C:\Program Files\PostgreSQL\16\bin`. Used an isolated temporary cluster on loopback port 55487, applied schema twice and role grants with test-only passwords, ran all 34 backend tests without skips, then stopped the cluster. Production PostgreSQL 17/staging validation remains a release gate.
- Frontend: 14 unit tests passed; Vite production build passed. Fixture-based headless Chrome verified search handoff, repeated searches/page reset, source filtering, stale-request isolation, wishlist reload persistence and touch visibility. No browser automation dependency was added.
- `git diff --check` passed. No production database, seller feed, Vercel configuration, commit, push or deployment was changed.
- Partnerships, reuse permissions, pilot interviews, production cutover and manufacturer authorization remain unverified.

## Publication validation

- User explicitly requested committing and pushing to `main`, accepting any configured automatic deployment. The existing local commit `79ed518` is also part of that push; remote `main` was reconfirmed at `bde5541` before publication.
- Revalidated backend: 34 tests passed with no skips against a newly initialized, isolated PostgreSQL 16 cluster. Schema and role grants were each applied twice; database constraint, source-filtering, rollback and runtime-isolation checks passed. Temporary test passwords replaced container secret-file reads only in a temporary copy of the role script. The cluster was stopped and removed afterward.
- Revalidated frontend: all 14 unit tests, Vite production build and fixture-only Chrome smoke test passed. Browser checks cover repeated searches, pagination reset, source filtering, stale requests, saved-state reload and touch visibility.
- Publication review corrected the deployment verifier to skip database integration tests on the deployed database. Catalogue tests need a disposable owner connection; the deployment reader checks remain read-only. The credential-pattern scan flagged only the documented example password placeholder and a URL-rejection test fixture.
- PostgreSQL 17 staging validation and the schema/API/frontend deployment sequence remain release requirements. Publishing Git commits does not establish a successful production rollout; no production migration or Vercel setting was changed during publication preparation.