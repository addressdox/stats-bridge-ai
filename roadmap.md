# StatBridge roadmap

## Done

- Real South African data foundation — eight genuine approved publications seeded with verified observations (QLFS Q2 2025 33.2%, Census 2022, mid-2025 population, CPI Sep 2025, GDP Q2 2025, SARB repo 6.75%, GHS 2023, Budget 2025), with real URLs, publication numbers and verification records.
- Continuous crawler — harvests Stats SA, Reserve Bank and Treasury listing pages, dedupes, proposes new sources as pending. Staff → Sources, or a scheduler POSTing `/api/public/crawl` with the `CRAWL_TOKEN` header.
- Live AI provider wired server-side through the Lovable gateway; full safety pipeline verified end to end.
- Rich evidence blocks — statistics, tables, charts, images, video, documents and downloadable datasets, each only when an approved publication carries it.
- Public insights page at `/insights`.
- Visitor identity and conversation memory — visitors, identifiers, conversations, turns, analysis, handoffs, handoff events; returning-visitor recognition; erase-my-record.
- Meaning-based retrieval — pgvector index over approved extracts and figures, embeddings built through the Lovable gateway, merged with word search inside the answer pipeline. Rebuild endpoint `/api/public/embeddings`.
- Enterprise staff desk — Overview, Handover queue (accept / decline / transfer / close, reply as official), Conversations with analysis, People.
- Real South African woman's voice — ElevenLabs "Naledi" via `/api/speak`, streamed, with the built-in voice as fallback. Only checked wording is ever spoken.

## Open

1. Visitor-side contact capture and handover controls in the Ask room (name / email / phone with consent notice, "speak to a person" button, live official replies).
2. Assistant tool calling — server-side tools for search, comparison, case status, media request, contact capture and handover.
3. Insights: source freshness timestamps, interactive filters and drill-down, PDF and CSV export.
4. Tawk-style widget rebuild — compact launcher, widget-sized chat/voice panel, full-screen expand, link to the main app; independent hosted demo page.
5. Public API documentation on `/developers`.
6. Real-data evaluation (30-case set), then delete any remaining test/demo records.
7. Final compliance report.
