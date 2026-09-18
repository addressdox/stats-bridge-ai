# StatBridge — enterprise backend, live insights and human handoff

A large build, delivered in six phases. Each phase ends working and verifiable.

## Phase 1 — Visitor identity and conversation memory

Every person who chats or calls gets a record.

- The assistant asks for name, email and phone (required to progress a request), and may capture address and organisation when offered — never demanded.
- Returning visitors are recognised by a browser token plus matching email or phone, and the assistant greets them by name and can refer to what they asked before.
- Every conversation is stored: each turn, the outcome, the evidence used, the language, the channel (chat, voice, widget), duration and device.
- After each conversation the assistant writes a short summary, topic, sentiment, urgency and whether it was resolved — stored for the dashboard.
- Consent and privacy notice shown before capture; visitors can ask for their record to be removed.

## Phase 2 — Knowledge base with vector retrieval

- Turn on vector storage in the database and store an embedding for every approved passage, observation and released answer.
- Retrieval becomes hybrid: keyword search and meaning-based search combined and re-ranked, so a question worded differently still finds the right publication.
- Embeddings are generated when a source is approved and refreshed when a source changes; a backfill runs once over existing records.
- Nothing unapproved is ever retrievable — the approved-only rule is enforced in the retrieval function itself, not in the prompt.

## Phase 3 — Assistant personality, tools and human handoff

- One written persona and system instruction: a calm, precise South African public-information officer. Never guesses, never gives opinions, always names the publication, period and page. Same wording rules for voice and text.
- The assistant gets tools for everything a visitor is allowed to do: search approved statistics, fetch a figure, compare periods, list upcoming releases, check a case status, open a media request, capture or update contact details, request a human, and produce a chart, table or downloadable dataset.
- Tools run only at the visitor permission level. Staff-only and administrator actions are not reachable from the assistant.
- Handoff: the assistant tries to resolve first. When it genuinely cannot, or the person insists, it raises a handoff request with the full transcript, the captured contact details, topic and urgency.
- Staff see the request appear live in the dashboard with sound and badge. They can accept, decline with a reason, or transfer to a colleague. Accepting opens a live two-way conversation with the visitor in the same window they were already in.
- Media and sensitive requests keep the existing rule: acknowledgement and a case reference only, straight to a human.

## Phase 4 — Enterprise dashboard

A proper operations centre, not a set of pages.

- Overview: live conversations, waiting handoffs, today's volumes, resolution rate, average time to answer, coverage gaps.
- Conversations: searchable list of every chat and call with transcript, evidence used, analysis, visitor record and outcome.
- Handoff queue: incoming, mine, transferred, closed — with accept, decline, transfer.
- Visitors: contact records, history, linked cases and requests.
- Knowledge: existing sources, guidelines and memory, plus embedding health and crawler runs.
- Insights and the decision record, extended as below.
- Consistent enterprise layout: left navigation, sticky filter bar, dense tables with sorting and pagination, side drawers for detail, empty and loading states everywhere.

## Phase 5 — Insights: live feeds, filters, drill-down and export

- Source freshness: each publication shows when it was published, when it was last checked and when it was last changed, with a clear stale marker; the crawler updates these on every run.
- Filters across the whole page: date range, publisher, topic, geography, measure, outcome — reflected in the address so a filtered view can be shared.
- Drill-down: click any trend, announcement, topic, gap or follow-up to open a detail view with the underlying verified figures and their sources.
- Export: PDF and CSV of the current filtered view, each carrying the filters used, the generated-at time and full source citations.

## Phase 6 — End-to-end tests and cleanup

Automated browser tests covering: a cited statistic answer, a table, a chart, an image, a video, a document, a spreadsheet download, an unsupported request falling back safely, a media request producing only a case reference, contact capture, returning-visitor recognition, and a full handoff accepted by staff. Results reported exactly as observed — passed, failed or blocked. Then remaining demonstration records are removed.

## Technical notes

- Database: new tables `visitors`, `visitor_identifiers`, `conversations`, `conversation_turns`, `conversation_analysis`, `handoffs`, `handoff_events`, `embeddings`; `pgvector` enabled; RLS and explicit grants on every one; visitor-owned rows reachable only through server functions, never by the browser key.
- Retrieval: `search_knowledge(query, embedding, filters)` as a security-definer function returning hybrid-ranked passages and observations, restricted to approved versions.
- Embeddings via the Lovable AI gateway embedding model, generated server-side on approval and by a backfill server function.
- Assistant: existing `openai/gpt-6-astra` pipeline extended with tool calling; tools defined server-side in `src/lib/statbridge/tools.server.ts`; every tool result still passes the existing evidence contract before rendering.
- Live handoff and staff alerts over Supabase realtime on the `handoffs` and `conversation_turns` tables.
- Exports: CSV built server-side; PDF rendered from the same filtered payload so the two always agree.
- Tests with Playwright under `tests/e2e`, run against the local preview.

## Voice quality — a real South African woman's voice

The current voice sounds synthetic. It gets replaced.

- Speech is generated from a premium voice service (ElevenLabs) chosen for natural, human-sounding delivery, with a warm South African English female voice and pacing tuned for reading figures clearly.
- You do not need to paste a Gemini key — the voice runs through your Lovable connection, and I can link ElevenLabs in one step when we get there.
- Audio streams so speech starts almost immediately instead of waiting for the whole sentence.
- Long answers are split at sentence boundaries so nothing is cut off.
- If the premium voice is unavailable, it falls back to the built-in voice rather than failing silently.
- The rule stays: only validated, source-backed answer text is ever spoken.

## Out of scope for this round

Persona-specific themes, the briefing generator, and any non-South-African data remain excluded.
