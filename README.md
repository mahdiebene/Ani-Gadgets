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

## License

MIT