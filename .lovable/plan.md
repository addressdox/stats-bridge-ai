# StatBridge — progress against the specification

## Where we are

### Implemented and working
- **Foundation and design** — Sarkimota-style split entry gate (`/`), portrait-led voice call room and typed chat room (`/ask`) with "Type instead" / "Back to voice" switching, exact Sarkimota dark palette with warm light theme, theme toggle, improved fonts (Sora / Manrope / JetBrains Mono), retina-ready scaling, hidden scrollbars, reduced-motion support, favicon.
- **Desk and public pages** — `/desk` (Media desk, Track a request, Developers, Staff sign in), `/media` media intake, `/case` + `/case/$ref` private case status by reference and token, `/developers`, `/embed` widget.
- **Database** — 26 enums, 16 tables, indexes, immutability triggers, RLS on every table, private sources storage bucket, 15 transactional decision functions, 5 read-only views (review queue, insights, decision record), helper functions (search, rate limit, case reference).
- **Ask pipeline** — typed public contract (`contract.ts`), server-side retrieval/validation/safe block assembly (`pipeline.server.ts`), replaceable AI provider interface kept server-side (`provider.server.ts`), routing of media/sensitive/judgement requests to human review with acknowledgement + case reference only (`routing.server.ts`), public server functions (`public.functions.ts`).
- **Evidence Canvas** — safe renderer showing official source, page and period for every answer.
- **Staff area** — `/staff/sign-in`, review queue and workbench (`review.index`, `review.$id`), draft suggestion flow, approve/release/withdraw actions, knowledge sources with approval/rejection, guidelines, communication memory, insights (`/staff/insights`), decision record (`/staff/record`).
- **Voice** — push-to-talk via browser speech (en-ZA), permission only after explicit gesture, spoken summaries of safe answers, call states (connecting / listening / checking / speaking / ended).

### Still remaining per the specification
1. **Real AI provider wiring** — Gemini server-side via Lovable AI Gateway for answer wording within approved sources (provider interface exists; needs a live model behind it, currently demonstration logic).
2. **Real South African data foundation** — harvest genuine published statistics from Stats SA and other official bodies (Reserve Bank, National Treasury, municipal portals), load them as approved sources and verified observations through a migration, plus a documented reset procedure. This is the starting knowledge base.
3. **Continuous crawler** — a scheduled crawler that constantly harvests new official South African publications and feeds them into the knowledge base through the existing source-approval flow, so knowledge and coverage keep growing.
4. **Evaluation** — the 30-case test set from the specification, run and recorded (passed / failed / blocked), no invented results.
5. **Widget polish and independent demo host** — `/embed` exists; standalone hosted demo page still to do.
6. **Public API documentation completion** — `/developers` page exists; full endpoint reference and usage examples to finish.
7. **Chart support** — Recharts only where a verified observation justifies it (contract supports it; no charts shipped yet).
8. **Final compliance report** — what is implemented vs planned, exact routes, demo accounts, region, AI provider/model, known limitations, reset instructions.

## Proposed next step
Build the real South African data foundation: harvest genuine published statistics from Stats SA and partner official bodies, load them as approved sources and verified observations, then add the continuous crawler that keeps feeding the knowledge base — before wiring the live Gemini provider and running the 30-case evaluation.
