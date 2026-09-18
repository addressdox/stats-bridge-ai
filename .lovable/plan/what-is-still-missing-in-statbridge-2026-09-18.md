# What is still missing in StatBridge

Checked against the live app and database today: the code compiles cleanly, 8 approved publications with 25 embeddings are in place, 1 active guideline, 7 roles and 23 permissions exist, no demonstration records remain, and only 1 staff account exists.

Below is everything still outstanding, in the order I would do it.

## 1. Assistant tool calling (biggest functional gap)

The answer pipeline has no tool calling at all. Today the assistant retrieves text and figures, but it cannot decide to act. Add server-side tools the assistant may call during a conversation:

- search approved publications, look up a specific figure, compare two periods or provinces
- check a case status by reference
- capture visitor contact details
- open a media enquiry or request a person
- build a chart or table from verified figures only

The voice line already has its own tools; chat and the widget do not share them. Both surfaces should use one tool set so answers behave identically everywhere.

## 2. Permission enforcement is inconsistent in the database

The newer screens check fine-grained permissions, but several database actions still demand the old fixed "administrator" role: approving, rejecting and withdrawing a publication, activating guidelines, and a few settings actions. So a person given the right permission through the new role system can still be refused. These need migrating onto the permission checks.

## 3. Database security warnings

33 privileged database routines are still callable by any signed-in account. Each needs reviewing: tighten who may run it, or restrict it to the service side. This must be cleared before going live.

## 4. Knowledge base gaps

- No ingestion has ever been run through the new uploader, so PDF, Word, spreadsheet, Markdown and web-link capture is untested with real files.
- Web-page capture keeps plain text only; tables and figures in a page are lost.
- Figures extracted from uploads still need a person to check each one; there is no bulk verification screen, which makes large documents slow to approve.
- No automatic re-check of publications that change after approval beyond the crawler flag.

## 5. Insights need a history

Insights are calculated live every time. Nothing is ever saved, so there are no week-on-week or month-on-month comparisons and no alert history. Add a daily snapshot and let alerts be acknowledged and resolved so trends and service levels can be tracked over time.

## 6. Staff onboarding is untested

Only one account exists. The invitation flow, accepting an invitation, first sign-in, multi-role assignment, suspension and reactivation have never been exercised with a second person.

## 7. Widget sites are not configured

No widget site is registered, so the embeddable widget has no permitted website, no colour or opening message configured. Add a widget site management screen and register at least one.

## 8. Quality and release readiness

- A 30-question evaluation set of real South African questions, run end to end, recording how each was answered, referred or refused.
- Automated checks for the safety rules (media and sensitive questions must never receive a written answer).
- Browser walkthrough of every staff screen and the public flows.
- Page titles and descriptions per page reviewed for search and sharing.
- Final compliance write-up: privacy, retention, audit trail, South-Africa-only sourcing.

## Technical notes

- Tool calling: extend `src/lib/statbridge/provider.server.ts` and `pipeline.server.ts` with a tool schema, and share the existing voice-agent tool handlers.
- Permission migration: rewrite `approve_source`, `reject_source`, `withdraw_source`, `activate_guidelines` and remaining `require_role('administrator')` callers to use `require_permission`.
- Linter: `REVOKE EXECUTE ... FROM authenticated` for internal routines; keep only the ones screens genuinely call.
- Insights history: write into `insight_snapshots` on a daily schedule via `/api/public/*` with a token, and compare windows in `staff-insights.functions.ts`.
- Widget sites: CRUD over `widget_sites` behind a `settings.manage` permission.
- Evaluation: a scripted run against the ask pipeline, results stored as a report artefact.

## Suggested order

1 and 2 first (behaviour and access correctness), then 3, then 4 and 5, then 6 to 8 before release.
