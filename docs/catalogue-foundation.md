# Catalogue foundation: migration and boundaries

> Historical Phase 2 schema notes. The solo upgrade now adds local curation, restricted operational roles, allowlisted public views, comparison routes/UI, saved items and local price targets. The current workflow and migration details are in `E:\ani-gadgets\docs\solo-catalogue.md`. Statements below about pending comparison/import activation describe the earlier foundation, not current code. No partner feed was added.

The current implementation preserves the legacy listing API. It does **not** publish a comparison API, ingest a new merchant, or assert any authenticity guarantees.

## Data model

- `products`: existing URL-keyed Daraz/other listings. Existing IDs, wishlist keys and ingestion remain unchanged.
- `catalogue_products`: candidate exact identities with manufacturer/code, product line, edition, variant, scale, ISBN, language and volume. A reviewed identity requires a reference, reviewer and timestamp; it is still not proof that a particular seller's item is genuine.
- `merchants`: named sellers with separately documented data/image permissions and policy references. A grant needs a reference and checked timestamp. Importers must enforce permission scope, expiry and revocation before reuse; a schema flag alone is insufficient.
- `offers`: one merchant listing, optionally linked to a legacy listing and a candidate/reviewed catalogue identity. Condition, included parts and purchase route belong here. Candidate matches must not be compared as exact matches.
- `offer_observations`: timestamped price/stock observations. Full price and deposit are distinct. Null shipping/tax/fees/eligibility remain unknown. Shipping requires a destination. Currency applies to every amount in that observation. Revisions should append observations, not rewrite history.
- `evidence_records`: scoped to exactly one identity, merchant or offer, distinguishing seller claims, manufacturer references and independent reviews. A review records who reviewed the evidence; it is not an automatic authenticity verdict.

No automatic title matching, permission inference, seeded partners, currency conversion, landed totals or cross-seller ranking is implemented. No current process writes the new tables. Future imports must validate safe URLs and domain ownership, complete identity/condition/parts, feed permissions, freshness windows, deposit semantics, and observation provenance before publishing anything.

## Security

The new tables and sequences are owner-only. Both the API reader and Daraz ingestion writer are explicitly denied access. This prevents the existing unreviewed ingestion pipeline from manufacturing identities or evidence and keeps permission references private. A later curation/import role needs narrowly scoped grants; observations should be insert-only and never editable by the API. Expose only reviewed/public fields through a dedicated repository/API, not `SELECT *` on merchant/evidence records.

## Apply in staging before production

1. Take and verify a backup. Use a disposable PostgreSQL database for tests, never production credentials.
2. As database owner, run `E:\ani-gadgets\backend\db\schema.sql` with `psql -X -v ON_ERROR_STOP=1`. It is transactional and may be reapplied. No data is automatically merged or backfilled.
3. Reapply `E:\ani-gadgets\deploy\roles.sql` inside the existing deployment container, where its two password secret files exist. It retains legacy access and explicitly removes access to new catalogue tables. Do not copy secrets into this repository.
4. Run integration tests with `TEST_DATABASE=1` and the existing `DATABASE_URL` or PG environment configuration. The new catalogue integration test requires a disposable database-owner connection; role assertions also require provisioned reader/writer roles.
5. Verify schema reapplication, constraints, rollback, source metadata, source-filtered totals, legacy upserts and role isolation. The normal test command skips database tests unless explicitly enabled.
6. Deploy schema first, then API, then frontend. The new frontend source selector requires `/api/products/meta/sources`; do not release it against an old API. Verify live product requests/CORS after the authorized frontend redeployment.

Source filtering uses the actual available listing `source` values, not an assumed partnership list. `trending_score` is now an allowed sort field. Existing demand-score weights are unchanged; UI labels clarify that demand is not authenticity or quality.

## Rollback

Application rollback does not require deleting the new tables or changing old listing IDs. Roll back API/frontend together; leave the additive schema/data in place. If an unreleased schema change fails, the SQL transaction rolls back. Never drop populated catalogue tables to roll back application code. The new source index/function key can remain in place for older app versions. Before a later schema revision, use an explicit additive migration rather than assuming `CREATE TABLE IF NOT EXISTS` upgrades existing table definitions.

## Frontend limits

Wishlist persistence stores only `listing:<id>` keys in browser localStorage, not user accounts or copied product metadata. It synchronizes mounted cards and storage events. If persistence is blocked or full, saves last only for the current session. A dedicated wishlist page, product-identity wishlists, alerts and account synchronization are future work.

Listing cards deliberately say authenticity is not reviewed and delivery/final cost is unconfirmed. The new offer tables are not yet connected to these legacy cards, and deposit/import records must not be inserted into legacy `products.price` as if they were full BDT prices.