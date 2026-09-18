# StatBridge — build plan

An AI assistant for Statistics South Africa that answers public questions only from approved Stats SA material, always shows where each answer came from, and sends media, sensitive or judgement questions to a human for approval before anything is released. Built to a global standard, starting with South Africa.

## Decisions taken from your answers

- Built on the Lovable stack (built-in backend, database, sign-in, file storage, server-side functions). Every rule your documents place in "Edge Functions" and "database functions" is enforced server-side exactly as specified — nothing is moved into the browser.
- Gemini for voice (best coverage of South African languages and accents) and for the assistant wording. Your key is stored as a server secret; I will request it securely when we reach that step.
- Phased delivery, core journeys first. Each phase is working and testable before the next begins.

## Conflicts found in the attachments

1. The documents name Supabase Edge Functions and React Router; this project uses the Lovable stack's own server functions and router. Behaviour, security and API shape stay identical. Public endpoints are exposed at `/api/public/v1/*` so outside callers and the widget still work.
2. The architecture document says voice uses the browser's own speech features with no extra provider; you have chosen Gemini. Your instruction wins; browser speech stays as the fallback.
3. The specification asks for a separately hosted widget demo page at a different address. Inside one project I will ship the demo page at a distinct route and, at publish time, it can be placed on a separate address. I will state honestly which of the two is in place.

## What gets built, in order

**Phase 1 — Foundation**
Backend enabled. Full schema from SCHEMA.md: all 16 tables, every value list, immutability rules, indexes, full-text search, and the 5 read-only views. Security on every table from the first migration, public role has no table access. Staff roles held server-side; nobody can change their own role. Audit trail insert-only.

**Phase 2 — Knowledge and approval**
Source upload to private storage, text ingestion into located passages, verified figures recorded and checked by a person, and approval of an exact version. Nothing is searchable until approved. Correction, supersession and withdrawal keep the history.

**Phase 3 — Ask and the Evidence Canvas**
The public Ask page. Search approved material first, then the assistant proposes wording referencing evidence by id only; the server validates it, inserts the verified figures and document details itself, and refuses anything unsupported. Four outcomes only: referenced answer, clarifying question, honest gap, or escalation with a case reference.

The Evidence Canvas is the Sarkimota-style moment: the conversation stays central, and when an answer carries evidence the page opens into conversation plus evidence side by side on desktop, and a stacked or bottom-sheet view on phones that never covers the transcript or the keyboard. Evidence stays while the topic stays. Blocks: verified figure card, official quotation, comparison table, chart, document card, definition, caveat, clarification choices, gap, case acknowledgement, source list, follow-up actions.

**Phase 4 — Media Desk and private case status**
Media form with consent, immediate acknowledgement and case reference, private status link. Only a hash of the token is stored; an invalid token and a missing case give the same reply. Never a substantive AI answer.

**Phase 5 — Review, approval and release**
Queue and case workbench: escalation reason, deadline, owner, private draft, evidence per statement, gaps, guideline version, similar approved wording, immutable draft history. Edit, request changes, reject, approve the exact wording (fingerprinted), then release as a separate action. Editing voids approval. Release is blocked without the right role, without an active approval, on a fingerprint mismatch, after a supporting source is corrected or withdrawn, or if already released. A successful release writes the release, updates the case, files the communication memory with its evidence, and records the audit event in one transaction.

**Phase 6 — Guidelines, memory, source-change propagation**
Versioned guidelines with exactly one active version. Searchable approved communication memory with reuse states. Withdrawing or correcting a source flags exactly the affected answers, drafts and memory, and blocks affected releases.

**Phase 7 — Insights, decision record, widget, API**
Measured insights from real records with demonstration data labelled. Full decision record. A separate small plain-JavaScript `widget.js` that opens `/embed` in an isolated frame with verified messages, focus handling and Escape to close, proven on a demo host page. Versioned public API with published documentation and a sample client.

**Phase 8 — Seed data and testing**
Real prototype corpus: QLFS Q1 and Q2 2026 plus the media release, verified key figures, organisational pages and FAQs, historical communications, one active guideline version, one widget site, labelled demonstration identities and activity. Then the 30-case evaluation plus source withdrawal, approval invalidation, blocked release, token privacy, anonymous access, role restrictions, keyboard access and mobile layout. Results recorded exactly as observed.

**Phase 9 — Voice and chart polish**
Push-to-talk, visible recording state, editable transcript before sending, corrected text through the normal Ask path, read-aloud of the checked answer only. No avatar.

## Design

Restrained navy, teal, white and warm amber. High contrast, clear hierarchy, generous spacing, light pages for slow connections. Official source content is visibly, unmistakably separate from AI explanation everywhere it appears. Accessible tables, visible focus, keyboard navigation, reduced-motion support, phone-first layouts.

## Routes

`/`, `/embed`, `/media`, `/case/:ref`, `/developers`, `/staff/sign-in`, `/staff/review`, `/staff/review/:id`, `/staff/knowledge/sources`, `/staff/knowledge/guidelines`, `/staff/knowledge/memory`, `/staff/insights`, `/staff/record`. Staff routes are protected server-side. Every route gets loading, empty, error, permission-denied and success states.

## Technical notes

- Typed, versioned answer contract: a discriminated union of render blocks (`official_quote`, `metric`, `comparison_table`, `chart`, `document`, `definition`, `caveat`, `clarification`, `gap`, `case_acknowledgement`, `follow_up_actions`). Unknown types fail safely in the browser. No partial JSON is parsed client-side; rich blocks appear only after the server has validated and resolved them.
- The assistant may only propose evidence ids, block types, plain-language explanation and follow-ups. The server resolves ids, checks approval and audience, inserts figures and document metadata, verifies unit, period, geography and population, rejects unsupported causation, then stores the answer and its evidence links.
- Runtime validation on every input and every model response.
- Reported change is taken from the source, never calculated from rounded display values.
- Transactional database functions: `set_role`, `approve_source`, `reject_source`, `withdraw_source`, `activate_guidelines`, `open_case`, `assign_case`, `start_review`, `save_draft`, `request_changes`, `reject_case`, `approve_draft`, `release_draft`, `correct_routing`, `erase_contacts`.
- Project documents (`requirements.md`, `design.md`, `tasks.md`, `traceability.md`, `api/openapi.yaml`, test register) are written alongside the code, with every requirement traced to D1–D5, F1–F6, P1–P11, M1–M7, O1–O13, K1–K9, L1–L4 and D1–D7.

## What I will report at the end

What actually works, what is still planned, which tests passed, failed, were blocked or were not run, the routes and demonstration accounts, hosting region, AI provider and model, known limitations, and how to reset the demonstration. No self-awarded scores, no invented results, no compliance claims.
