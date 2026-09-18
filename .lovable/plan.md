# Enterprise StatBridge back office rebuild

Rebuild the staff area as a complete operational back office, not a collection of read-only pages. The live backend already contains eight sources, twelve searchable extracts, thirteen verified figures and twenty-five vector records, but the current screens do not provide the authoring, ingestion, governance and analysis workflows needed to manage them.

## 1. Enterprise staff shell and navigation

- Reorganise the staff area into clear groups: **Operations**, **Knowledge**, **Intelligence**, **Governance** and **Administration**.
- Add a compact desktop sidebar, proper mobile sheet navigation, breadcrumbs, page actions, global search, notifications, role-aware links and clear permission-denied states.
- Give every page a consistent workspace pattern: headline metrics, filters, sortable table, detail drawer/page, actions, loading state, empty state and useful error detail with retry.
- Replace misleading empty messages such as “Nothing waiting” with operational context, service status and the next useful action.
- Keep every privileged action enforced on the server; hiding a link is never the security boundary.

## 2. Full knowledge-base workspace

Create a dedicated **Knowledge Base** area with tabs for Library, Ingestion queue, Extracts, Verified figures, Vector index, Crawler and Health.

### Capture and ingestion

- Add a “New knowledge source” workflow supporting:
  - PDF, DOCX, TXT, Markdown, CSV and XLSX upload;
  - official South African web URL capture;
  - metadata: title, publisher, publication type, topic, publication date, reference period, geography, audience and version notes.
- Store uploads privately in the existing source-file store, with checksum, MIME type, file size and version history.
- Parse files and web pages on the server, preserve page/sheet/section location, split text into traceable extracts and show a preview before approval.
- Use the linked Firecrawl service for robust official-URL capture after linking it to this project; restrict ingestion to approved South African government/statistical domains or require explicit administrator review for a new domain.
- The crawler will move beyond link discovery: fetch each proposed publication, create an ingestion job, extract text, classify it and place it in review.

### Verification and publication

- Provide an ingestion queue with stages: discovered/uploaded, extracting, extracted, needs metadata, figure verification, ready for approval, approved, failed and superseded.
- Add a source-detail workspace showing the original file/link, extracted passages, detected tables/figures, version history, validation errors and audit trail.
- Let authorised knowledge staff edit metadata, correct extracts, add/verify observations, reject, approve, supersede or withdraw a version with reasons.
- Approval remains the hard safety gate: only approved versions, reviewed extracts and human-verified figures can enter public retrieval.
- On approval, generate/upsert embeddings automatically; on withdrawal or supersession, remove the version from retrieval and flag dependent answers/memory.

### Vector and retrieval health

- Show embedding coverage by source, missing/stale vectors, model used, last indexed time and failures.
- Add administrator actions to index one version, retry failures or rebuild all missing vectors.
- Add a staff-only retrieval tester showing keyword hits, semantic hits, final ranking, source/version/page and why a result is eligible.
- Keep hybrid retrieval enforced in the backend and approved-only at database level.

## 3. Real guidelines and communication governance

Replace the current read-only guideline card with a versioned authoring workspace.

- Create, edit, duplicate, preview, compare, activate, retire and restore draft guideline versions.
- Structured sections: identity/persona, factual boundaries, evidence and citation rules, number/date style, terminology, prohibited claims, media policy, sensitive-topic policy, escalation rules, voice delivery, multilingual behaviour, channel-specific wording and examples.
- Add terminology pairs (“use” / “avoid”), required phrases, forbidden phrases and example responses through proper repeatable controls.
- Validate drafts before activation and show exactly which required governance sections are incomplete.
- Compare two versions side by side; activation retires the prior version atomically and records the full change in the decision record.
- The answer and draft pipelines will load the active guideline so these rules actually govern chat, voice, widget, API and staff-assisted replies.

## 4. Enterprise roles, permissions and staff lifecycle

Replace the three-role enum stored on profiles with secure RBAC tables: roles, permissions, role_permissions and user_roles. Roles remain separate from staff profiles.

- Seed system roles aligned to the application: Super Administrator, Knowledge Administrator, Communications Manager, Communications Official, Media Officer, Insights Analyst and Read-only Auditor.
- Add granular permissions for dashboard access, cases, handoffs, conversations, visitors, source upload, source verification, source approval, crawler control, vector rebuild, guideline authoring/activation, insights export, audit access, settings and staff administration.
- Build role management: create custom roles, clone roles, edit permission matrices, archive unused custom roles and view affected staff.
- Build staff management: invite/create staff, assign one or more roles, promote/demote, suspend/restore, force password reset, revoke sessions and inspect last sign-in/activity.
- Protect the last active Super Administrator from demotion or suspension and prevent privilege escalation.
- Every role/staff change is validated server-side and written to the immutable audit record.

## 5. Decision-grade insights

Replace the three basic tables with an intelligence workspace built from verified sources, conversations, searches, cases, handoffs, crawler activity and knowledge health.

### Executive view

- Date-range comparison with previous period.
- Demand: conversations, unique people, questions, channel mix, language mix and returning visitors.
- Service: assistant resolution, handoff rate, waiting age, first-response time, resolution time, SLA attainment and backlog by urgency/owner.
- Knowledge: answer coverage, citation rate, unsupported demand, stale sources, pending approvals, failed ingestions and vector coverage.
- Risk: sensitive/media escalations, overdue cases, source-change impact, failed answers and repeated complaints.

### Audience and topic intelligence

- Trends by topic, geography, publication, measure, audience/persona and channel.
- Emerging questions and acceleration, not only total counts.
- Query-gap clusters with examples, demand volume, affected audiences and recommended source/crawler action.
- Likely follow-up questions derived only from real conversation sequences and verified source relationships.
- Current official announcements and changed figures with source freshness and impact on prior answers.
- Decision cards explaining what changed, why it matters operationally, supporting records and a concrete action (assign, crawl, review, publish or monitor)—without AI inventing business claims.

### Drill-down and reports

- Global filters stored in the URL: date range, channel, language, topic, geography, source, outcome, urgency, team member and demo/real data.
- Every metric opens its underlying records; charts never become dead-end decoration.
- Export filtered executive and operational reports to CSV and PDF with generated-at time, filters and citations.
- Scheduled snapshots and anomaly alerts are recorded so the dashboard monitors trends without waiting for a staff member to open it.

## 6. Repair all existing staff workspaces

- **Overview:** actionable queues, service health, knowledge health, alerts and recent activity.
- **Review queue:** assignment, ownership, SLA/deadline, filters, bulk triage and clear distinction between media cases, escalations and source reviews.
- **Sources:** move to the full knowledge-base workspace and fix the current loading failure by using authenticated server functions instead of fragile direct browser joins.
- **Communication memory:** import approved historical statements/FAQs, inspect evidence, review stale items, change reuse status and see where each item was reused.
- **Decision record:** searchable/filterable audit timeline with before/after, actor, reason, related source/case/guideline and export.
- **People and conversations:** richer filters, transcript/evidence/analysis drill-down, consent/retention status and safe data-removal workflow.
- **Handover queue:** ownership, transfer history, phone/chat channel details, SLA timers, notifications and live reply controls.
- **Desk settings and account:** grouped enterprise settings, validation, feature status, notification preferences, security/session controls and password protection guidance.

## 7. Backend reliability and security

- Move all staff reads/writes into authenticated server functions with Zod validation, stable response contracts and safe detailed errors; components never query protected operational tables directly.
- Implement RBAC helpers with security-definer checks that avoid recursive policies; never trust browser state for permissions.
- Add ingestion jobs and events for resumable processing, retries and visible failure reasons.
- Preserve private file access, row-level security, explicit grants, immutable audit/release records and South Africa-only source rules.
- Add indexes for queue, insight and retrieval filters; measure slow queries after representative data exists.
- Fix the current source/guideline/insight permission failures and add route-level error boundaries.

## 8. Verification

- Test Super Administrator, Knowledge Administrator, Communications Manager, Official, Analyst and Auditor access separately.
- Test upload and ingestion for PDF, DOCX, Markdown, TXT, CSV and XLSX, plus an official web URL.
- Confirm extraction locations, human figure verification, source approval, vector creation, hybrid retrieval and citations end to end.
- Confirm an unapproved/withdrawn source is never retrieved by chat, voice, widget or API.
- Test guideline draft/compare/activation and prove the active rules reach the answer pipeline.
- Test staff creation, promotion, multi-role assignment, suspension, last-admin protection and audit entries.
- Test every dashboard filter, drill-down and PDF/CSV export on desktop and mobile.
- Report exact pass/fail/blocker results; do not present seeded or demonstration activity as real business insight.

## Technical details

- New backend entities: `roles`, `permissions`, `role_permissions`, `user_roles`, `knowledge_ingestion_jobs`, `knowledge_ingestion_events`, `crawler_runs`, `insight_snapshots` and `insight_alerts`; each receives explicit grants, row-level security and audited privileged mutations.
- Existing `profiles.role` is migrated safely into `user_roles`, then retained only temporarily for compatibility while all permission checks move to `has_permission(user_id, permission_key)`.
- Parsing is server-side with edge-compatible libraries: PDF text extraction, DOCX XML extraction, Markdown/TXT parsing, CSV parsing and XLSX sheet extraction. Files stay private.
- URL ingestion uses Firecrawl when connected; the existing simple official-site crawler remains a fallback for discovery only, never for making content searchable by itself.
- Embeddings continue with the project’s Gemini key and `gemini-embedding-2`; index only approved content and track model/version timestamps.
- Recharts is used only for evidence-backed trends where the underlying records are available in the drill-down.
