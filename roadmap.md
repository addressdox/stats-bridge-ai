# StatBridge roadmap

## Done this round

- Real South African data foundation — eight genuine approved publications seeded with verified observations (QLFS Q2 2025 33.2%, Census 2022, mid-2025 population, CPI Sep 2025, GDP Q2 2025, SARB repo 6.75%, GHS 2023, Budget 2025), all with real URLs, publication numbers and verification records.
- Continuous crawler — `crawler.server.ts` harvests Stats SA, Reserve Bank and Treasury listing pages, dedupes, and proposes new sources as pending (never searchable until staff approve). Run from Staff → Sources → "Run crawler now" (administrators), or by an external scheduler POSTing `/api/public/crawl` with the `CRAWL_TOKEN` header (401 without it).
- Live AI provider wired — server-side, streamed via the Lovable AI gateway; the whole safety pipeline verified live: routing, retrieval, clarification, verified-figure blocks, official quotes, references and caveats. End-to-end test: unemployment question → clarification → 33.2% QLFS answer with full evidence panel.
- Search fixes — strict full-text match with ranked fallback; seeded figures now count as verified via their verification timestamp.
- Clarification chips now send human-readable text (was a raw machine value).

## Open

1. Real-data evaluation (30-case set) against the seeded/crawled data; then delete any remaining test/demo records.
2. Tawk-style widget rebuild — compact launcher bubble, widget-sized chat/voice panel, full-screen expand, link to the main app; independent hosted demo page.
3. Public API documentation completion on `/developers`.
4. Rich dynamic output — the AI can already render charts/tables/quotes/metrics from evidence; extend to images, video, documents and Excel/CSV blocks.
5. Follow-ups (P9, up to 3, KB-grounded), insights views (L1–L4), briefing (stretch), persona themes (later).
6. Final compliance report.
