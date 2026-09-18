# Naledi by AddressDox

The application and voice assistant are named Naledi. Existing deployment URLs, API paths, browser storage keys and legacy widget integrations remain compatible. The approved documents below retain their original filenames.

# Stats Bridge AI

You are the lead product architect, UX designer, senior React engineer, Supabase engineer and responsible-AI engineer for Naledi.

Your task is to produce an implementation-ready specification and then build the approved Naledi prototype using React, Vite, TypeScript and Supabase.

1. Read the attached documents first

Before designing or writing code, read every attached document completely:

StatBridge-Challenge-Specification-v3.pdf

StatBridge-User-Story-Flows-v1.pdf

StatBridge-User-Story-Flows-v1.txt

ARCHITECTURE.md

SCHEMA.md

Treat them as the approved source of truth.

If anything appears inconsistent, apply this order of authority:

StatBridge-Challenge-Specification-v3.pdf

StatBridge-User-Story-Flows-v1.pdf

ARCHITECTURE.md

SCHEMA.md

The implementation guidance in this prompt

The PDF version of the user-story flows takes precedence over the text copy.

Do not merge in earlier proposals, abandoned concepts or assumptions from other projects. Do not expand the submission into WhatsApp, Microsoft Office, WordPress, news monitoring, social-media monitoring, avatars or a complete Stats SA website. Those are future integrations outside this approved submission.

Do not claim anything has been completed or passed until it exists and its acceptance test has been executed.

2. Product definition

Build Naledi: an AI-enabled assistant for Stats SA public and media information queries.

Naledi must:

Answer ordinary public questions using only approved Stats SA sources.

show exactly where every answer came from;

keep official source content visibly separate from AI-generated explanation;

answer statistical, publication-finding, definition and organisational questions;

ask a clarifying question when period, geography, measure or context is unclear;

state an honest gap when approved sources do not support an answer;

recognise or receive media, sensitive, interpretive and formal-position requests;

give media requesters an acknowledgement and case reference only;

prepare a private, referenced draft for authorised communications officials;

require human review, exact-version approval and a separate release action;

retain approved communications as searchable organisational memory;

identify answers, drafts and memory affected by a corrected or withdrawn source;

work as a standalone application, an embeddable widget and a documented API.

The central rule is:

Supported public facts may be answered immediately with sources. Media, sensitive, interpretive, complex, ambiguous or formal-position requests must wait for an authorised person.

3. Required technology

Use:

React

Vite

TypeScript

Supabase PostgreSQL

Supabase Auth

Supabase Storage

Supabase Edge Functions

Supabase Row Level Security

PostgreSQL full-text search first

Zod or equivalent runtime validation

React Router

TanStack Query

an accessible component system such as shadcn/ui and Radix

Recharts only where a verified chart is justified

The AI provider must sit behind a replaceable server-side interface. Never call it directly from the browser.

The public Supabase key may exist in the browser. The service-role key and AI-provider key must exist only in Edge Function secrets.

Do not introduce vector search until the approved evaluation cases show that PostgreSQL full-text search is insufficient.

4. Required project outputs

If operating as a specification agent such as Kiro, create:

requirements.md

design.md

tasks.md

traceability.md

api/openapi.yaml

a route and screen inventory;

a typed answer/render contract;

a Supabase migration plan;

an RLS policy matrix;

an Edge Function contract;

a test and demonstration plan.

Write requirements as testable user stories with EARS-style acceptance criteria where appropriate.

Every requirement must trace to at least one of:

D1 to D5 from the master specification;

F1 to F6 from the master specification;

P1 to P11;

M1 to M7;

O1 to O13;

K1 to K9;

L1 to L4;

D1 to D7 from the user-story document.

If operating as an implementation agent such as Lovable, first establish those requirements and design decisions, then implement the application. Do not replace backend controls with visual mock-ups.

5. The four principal product areas

Ask

Public and anonymous. No registration.

Support typed questions first. Voice is a secondary enhancement and must never be required.

Ask returns one of four useful outcomes:

Referenced answer

Clarifying question

Honest gap

Escalation acknowledgement with a case reference

Every answered response must visibly contain:

the question;

an Official source area;

verified facts or quotations;

an AI-generated explanation label;

references with document title, publication date, page or section and public link;

relevant caveats;

up to three grounded follow-up questions;

a “Send this to an official” action.

Media Desk

Provide a mobile-friendly form for:

name;

media outlet;

contact details;

deadline;

question;

privacy notice and consent.

A submitted media query must immediately return:

an acknowledgement;

a human-readable case reference;

a private status link or token.

It must never return an AI-written substantive response.

A clear media request entered into ordinary Ask must enter the same case workflow.

Review

Available only to signed-in communications officials.

Provide:

review queue;

escalation reason;

deadline;

case owner;

case status;

original question;

private AI draft;

evidence for each supported statement;

information gaps;

guideline version;

similar approved communications;

immutable draft-version history;

edit;

request changes;

reject with reason;

approve exact wording;

separately release the approved wording.

Editing an approved draft must void its approval. A corrected or withdrawn supporting source must void approval and block release.

Knowledge Base

Provide three clear shelves:

Sources and verified observations

Communication guidelines

Approved communication memory

A newly uploaded source starts as Pending and must not be searchable until an administrator approves that exact version.

Support source correction, supersession and withdrawal without deleting the historical record.

6. Sarkimota-inspired conversational evidence canvas

The primary interaction reference is Sarkimota’s Amina experience.

Sarkimota’s useful pattern is:

the conversation remains central;

the assistant maintains a structured scene state;

when a vehicle is discussed, the layout changes from a single conversation view into a conversation plus product presentation;

the product panel remains visible while the same subject is being discussed;

new sections and bullets appear as the conversation progresses;

desktop uses a split layout;

mobile presents the rich content in a responsive stacked or sheet layout;

transitions help the user understand that the displayed content belongs to the current conversation.

Adapt this pattern to statistical evidence. Do not reproduce its automotive language, dark luxury styling, hard-coded keyword detection, external fallback images or fragile parsing of JSON from partial conversational text.

For Naledi:

The conversation occupies the main area.

When the answer contains data or evidence, open a contextual Evidence Canvas.

On desktop, transition to a two-column layout: conversation on the left and evidence on the right.

On mobile, place the evidence immediately below the answer or in an accessible bottom sheet that never hides the transcript or keyboard controls.

Keep the current evidence visible while follow-up questions remain on the same topic.

Replace it only when the topic or selected evidence changes.

Let the user close, reopen or expand it.

Preserve the conversation when layouts change.

Use modest, purposeful animation with reduced-motion support.

Never make essential information depend on animation.

The Evidence Canvas must support these block types:

verified metric card;

official quotation;

comparison table;

simple chart;

document or publication card;

definition or methodology card;

caveat or comparability notice;

clarification choices;

gap card;

escalation acknowledgement;

source list;

grounded follow-up actions.

A statistical answer should feel as rich and immediate as Sarkimota showing a vehicle, its image, price and features during a conversation. In Naledi, the assistant should be able to discuss a finding while the interface simultaneously displays the verified value, period, geography, comparison, source document, table and supporting page.

7. Safe structured rendering

Do not allow the model to generate arbitrary components, HTML, URLs, numbers or chart data.

Use a strict, versioned response contract.

The AI may propose:

which approved passage IDs support a statement;

which verified observation IDs should be displayed;

the intended block type;

a plain-language explanation;

grounded follow-up questions.

The server must:

validate the proposed structure;

reject unknown evidence IDs;

resolve IDs against approved, audience-appropriate records;

insert verified values itself;

insert document metadata and links itself;

verify period, geography, population and unit;

ensure every factual claim has evidence;

reject unsupported causation;

store the answer and evidence links;

return a safe public DTO to the browser.

Use a discriminated union similar to:

type PublicRenderBlock =
  | {
      type: "official_quote";
      text: string;
      source: PublicSourceReference;
    }
  | {
      type: "metric";
      label: string;
      displayValue: string;
      unit: string;
      geography: string;
      referencePeriod: string;
      reportedChange?: string;
      comparabilityNote?: string;
      source: PublicSourceReference;
    }
  | {
      type: "comparison_table";
      title: string;
      columns: string[];
      rows: Array<Record<string, string>>;
      sources: PublicSourceReference[];
    }
  | {
      type: "chart";
      title: string;
      chartType: "bar" | "line";
      series: VerifiedPublicSeries[];
      table: AccessibleTableData;
      sources: PublicSourceReference[];
    }
  | {
      type: "document";
      title: string;
      publisher: string;
      publishedOn?: string;
      referencePeriod?: string;
      pageNumber?: number;
      sectionLabel?: string;
      excerpt?: string;
      url: string;
    }
  | {
      type: "definition";
      term: string;
      officialText: string;
      explanation: string;
      source: PublicSourceReference;
    }
  | {
      type: "caveat";
      severity: "information" | "important";
      text: string;
      source?: PublicSourceReference;
    };

The browser renders only known block types. Unknown block types fail safely.

Do not stream incomplete JSON into the renderer. Text may stream separately, but rich blocks must appear only after the server has validated and resolved the complete structure.

8. Statistical rendering rules

The AI must never type a factual number from memory.

All public figures come from approved and human-verified observations records.

Display:

measure;

published display value;

unit;

geography;

population where relevant;

reference period;

adjustment status where relevant;

reported change;

comparability warning;

document;

table or page reference.

Use the source’s reported_change instead of calculating a change from rounded display values.

Do not confuse:

per cent and percentage points;

zero and missing data;

current and historical periods;

national and provincial geography;

official source wording and AI explanation.

Charts are a stretch feature after the Must journeys work. The component contract may support them from the beginning, but a chart must:

use only resolved observation records;

keep the same values as the prose and metric cards;

include units and periods;

include an equivalent accessible table;

list its sources;

never infer missing points;

never imply causation.

Core rich rendering should prioritise metric cards, source/document cards, official quotations and comparison tables.

9. Conversation and voice behavior

Typing must provide the complete experience.

If voice is implemented:

use push-to-talk;

show a visible recording state;

show the transcript before submission;

allow correction of names, dates and figures;

send the corrected text through the same Ask pipeline;

read aloud only the final checked answer text;

hide or disable voice gracefully when unsupported;

never auto-start the microphone;

never allow a speech model to improvise a different answer.

Do not add an avatar in this submission.

10. Required routes

Implement the approved routes:

/ — Ask

/embed — public Ask view for the widget frame

/media — Media Desk

/case/:ref — private case-status page requiring the token

/developers — widget quick start, API documentation and sample client

/staff/sign-in

/staff/review

/staff/review/:id

/staff/knowledge/sources

/staff/knowledge/guidelines

/staff/knowledge/memory

/staff/insights

/staff/record

Protect all staff routes.

11. Required database design

Implement the approved schema from SCHEMA.md. Do not collapse the schema into a generic documents table.

Required tables:

profiles

sources

source_versions

passages

observations

guidelines

answers

evidence_links

cases

drafts

approvals

releases

memory_items

audit_events

widget_sites

rate_counters

Required read-only views:

review_queue

insight_topics

insight_gaps

insight_turnaround

decision_record

Use the value lists, immutable-record rules, relationships, state transitions and indexes specified in SCHEMA.md.

12. Required server functions

Public Edge Functions:

ask

escalate

media-query

case-status

Staff Edge Functions:

draft

ingest

Transactional database functions:

set_role

approve_source

reject_source

withdraw_source

activate_guidelines

open_case

assign_case

start_review

save_draft

request_changes

reject_case

approve_draft

release_draft

correct_routing

erase_contacts

Status changes, approval and release must be enforced by database functions. Hiding or disabling a button is not security.

13. Security rules

These are mandatory:

Enable RLS on every table in the first migration.

Give the anonymous/public role no direct table access.

Route all public activity through the four public Edge Functions.

Read staff role from a server-controlled profile.

Prevent a user from changing their own role.

Filter source status and audience before content reaches the AI.

Treat document text as untrusted data, not instructions.

Never return drafts, restricted sources or private contact data through public endpoints.

Store only a hash of the private status token.

Use the same response for an invalid token and a nonexistent case.

Rate-limit public functions.

Keep audit events insert-only.

Keep secret keys server-side.

Avoid logging draft content or personal contact details.

Label demonstration accounts, approvals and seeded records.

State the Supabase hosting region and AI provider honestly.

Do not claim POPIA certification.

14. Visual direction

Create a polished public-sector information product, not a generic SaaS dashboard and not a conventional chat bubble screen.

Use:

a restrained navy, teal, white and warm amber palette;

high contrast;

clear typographic hierarchy;

generous spacing;

light pages suitable for slow connections;

compact status badges;

strong distinction between official information and AI explanation;

visible document provenance;

accessible tables;

meaningful empty, loading, retry, denied and failure states;

responsive layouts designed from phone size upward.

The Ask experience should be calm and focused. A first-time user must immediately understand:

what they may ask;

that answers come from approved Stats SA material;

which content is official;

which wording was generated by AI;

how to open the source;

how to reach an official.

Do not present demonstration content as an official Stats SA endorsement.

15. Widget

Produce a second Vite library build that outputs a small plain JavaScript widget.js.

The loader must:

add an assistant button;

open /embed in an isolated iframe;

avoid leaking React or styles into the host page;

accept site key, position, accent colour, language and opening text;

use postMessage only for open, close, ready and resize;

verify origins;

use a titled iframe;

use allow="microphone" if voice is enabled;

move focus into the widget when opened;

return focus when closed;

close on Escape;

open the standalone app if the iframe cannot load.

Prove it on a separately hosted demo page.

16. Seed content

Use a small, real and balanced prototype corpus:

QLFS Q1 2026;

QLFS Q2 2026 and its media release;

human-verified key observations;

five to eight public organisational pages or FAQs;

three to five real published historical communications;

two or three demonstration-approved FAQ responses;

one demonstration communication-guideline version;

one demo widget site;

clearly labelled demo identities and seeded activity.

Do not ingest hackathon documents, team transcripts or internal planning notes into the public knowledge base.

17. Acceptance and demonstration

Create the approved 30-case evaluation set:

10 supported factual, publication-finding, definition and organisational questions;

5 statistical or temporal traps;

5 media requests;

5 ambiguous or unsupported requests;

5 permission or adversarial requests.

Critical failures include:

unsupported figures presented as verified;

invented references;

substantive media answers before approval;

private or staff-only source exposure;

edited drafts retaining approval;

release after a supporting source is withdrawn;

public access to drafts, cases or staff functions.

The five-minute demonstration must show:

a sourced public statistical answer;

a non-number information question;

an unsupported causal question producing an honest gap;

a media request producing acknowledgement only;

the private referenced draft;

an unauthorised release being blocked;

human edit, exact-version approval and release;

reuse of an earlier approved communication;

a source correction flagging only affected records;

the widget on an independent host and the documented API.

18. Build priority

Protect the Must journeys first.

Build in this order:

Supabase project, migrations, RLS, roles and versioned API contract.

Source ingestion, source approval and verified observations.

Ask with referenced answers and honest gaps.

Media intake and stored case.

Review, draft versions, exact approval and transactional release.

Guidelines and communication memory.

Source-change propagation and blocked release.

Widget, independent host, API documentation and sample client.

Accessibility, permission and adversarial tests.

Only then: voice, follow-ups, insights, two draft formats, charts, Briefing or another reviewed language.

Never sacrifice approved-source grounding, media review, exact approval, communication memory, guidelines, access control or testing to add visual extras.

19. Required final response

Before implementation, return:

your understanding of the product in one paragraph;

any contradiction found in the attachments;

the proposed file and module structure;

the typed response/render contract;

the Supabase migration and RLS plan;

the implementation sequence;

the requirement-to-test traceability matrix.

Then build the application.

At completion, report:

what is actually implemented;

what is still planned;

which tests passed, failed, were blocked or were not run;

the exact routes and demo accounts;

the deployment and hosting region;

the AI provider and model;

known limitations;

how to reset the demonstration.

Never award the product its own judging score, invent test results or claim full compliance.


again i mean(Build the complete, production-quality Naledi application from start to finish.

This is an implementation request. Do not return only a product specification, architecture proposal, implementation plan, wireframe or UI prototype. Create the actual working application, database, authentication, security policies, server functions, workflows, widget, API and demonstration data.

Read the attached documents completely

Before making changes, read every attached file:

StatBridge-Challenge-Specification-v3.pdf

StatBridge-User-Story-Flows-v1.pdf

StatBridge-User-Story-Flows-v1.txt

ARCHITECTURE.md

SCHEMA.md

These are the final approved project documents.

Use this authority order if anything conflicts:

StatBridge-Challenge-Specification-v3.pdf

StatBridge-User-Story-Flows-v1.pdf

ARCHITECTURE.md

SCHEMA.md

This prompt

The PDF user-story document takes precedence over its text copy.

Do not replace the approved product with a generic chatbot, statistics dashboard, media-monitoring tool or UI mock-up.

What you are building

Build Naledi, an AI-enabled assistant for Statistics South Africa public and media information queries.

Naledi must provide a complete, working service for:

members of the public;

journalists and media requesters;

communications officials;

knowledge administrators;

communications managers;

Stats SA web developers.

The completed application must have four core areas:

Ask for public questions.

Media Desk for journalist and media requests.

Review for staff drafting, approval and release.

Knowledge Base for approved sources, guidelines and communication memory.

Also build:

private case-status pages;

staff insights;

an audit and decision record;

an embeddable website widget;

a documented public API;

an independently hosted widget demonstration page;

Supabase migrations, functions, policies and seed data.

Required stack

Use:

React;

Vite;

TypeScript;

Supabase PostgreSQL;

Supabase Auth;

Supabase Storage;

Supabase Edge Functions;

PostgreSQL full-text search;

Row Level Security on every table;

React Router;

TanStack Query;

Zod or equivalent runtime validation;

shadcn/ui or Radix primitives;

Recharts for verified charts;

a replaceable server-side AI provider interface.

The AI provider, service-role key and all privileged operations must remain server-side.

Non-negotiable product rule

Public factual questions may be answered immediately only when approved public sources support the answer.

The following must always go to human review:

media requests;

sensitive requests;

requests requiring judgement;

causal or interpretive questions;

complex requests;

official-position requests;

unresolved ambiguity;

low-confidence answers;

requests not covered by approved sources.

Media and sensitive requests receive an acknowledgement and case reference. They must never receive an unapproved AI-written substantive response.

Build the complete application

Public Ask experience

Create the / route.

A person must be able to:

ask without registering;

type a natural-language question;

use the application on a phone;

ask statistical and non-statistical questions;

ask where to find a publication;

ask for a definition;

ask for organisational information;

receive a concise answer from approved sources;

open every supporting source;

see official information separated from AI explanation;

select grounded follow-up questions;

ask for a short or detailed explanation;

submit an unanswered question to an official.

Every successful answer must contain:

the original question;

an Official source section;

verified facts, quotations or observations;

an AI-generated explanation label;

source title;

publisher;

publication date;

page or section;

source link;

reference period;

geography;

population and unit where applicable;

comparability warnings;

up to three grounded follow-up questions;

a “Send this to an official” action.

The four possible Ask outcomes are:

Answered

Clarification required

Honest knowledge gap

Escalated to a case

Never silently fall back to the model’s own knowledge.

Media Desk

Create /media.

Collect:

requester name;

media outlet;

contact details;

deadline;

question;

privacy consent.

After submission, return:

acknowledgement;

human-readable case reference;

private case-status link or token.

Do not return a substantive AI response.

A clear media request submitted through ordinary Ask must enter this same workflow.

Private case status

Create /case/:ref.

Require both the reference and valid private token.

Show only:

received;

draft being prepared;

in review;

released;

rejected, if appropriate;

the final released response and references after release.

Never show:

private drafts;

internal comments;

staff identities that are not intended for the requester;

restricted sources;

approval records;

other cases.

Store only a hash of the private token.

Staff authentication

Create /staff/sign-in.

Use Supabase Auth.

Implement these server-controlled staff roles:

communications official;

knowledge administrator;

communications manager.

Do not trust a role stored in browser state. Read and enforce the role through Supabase and database policies.

Communications Review

Create:

/staff/review

/staff/review/:id

The queue must show:

case reference;

question;

escalation reason;

media deadline;

status;

assigned official;

source-change warnings;

most urgent cases first.

The workbench must show:

original query;

requester context allowed for staff;

AI-prepared private draft;

evidence supporting each statement;

gaps;

source versions;

active communication-guideline version;

similar approved communications;

all draft versions;

approval status;

source-change warnings.

Officials must be able to:

start review;

edit the draft;

save a new immutable draft version;

request an AI redraft;

provide a redraft instruction;

reuse or adapt approved earlier wording;

choose an FAQ answer or short media-statement format;

request changes;

reject with a reason;

approve the exact current version;

separately release the approved version.

Approval must store a fingerprint of the exact text.

Any later edit must void the approval.

Release must fail when:

the user lacks the correct role;

there is no active approval;

the approved fingerprint differs from the latest draft;

a supporting source was corrected or withdrawn;

the response has already been released.

Successful release must transactionally:

store an immutable release;

preserve the exact approved wording;

update the case;

create the communication-memory item;

create its evidence links;

write the audit event;

make the response visible on the requester’s status page.

Knowledge Base

Create:

/staff/knowledge/sources

/staff/knowledge/guidelines

/staff/knowledge/memory

Sources

Allow administrators to:

add a source;

upload a file to private Supabase Storage;

add a public source URL;

record its title, publisher, type, topic, audience and version;

ingest text with page and section location;

inspect extracted passages;

record and verify key observations;

approve a pending source;

reject a pending source;

upload a corrected version;

supersede an older version;

withdraw a source with a reason.

Uploading or ingesting a file must not make it searchable.

Only an approved source version may be searched.

Verified observations

Implement verified statistical observations as separate records.

Each observation must include:

measure;

stable measure key;

numeric value where reported;

value state;

published display value;

unit;

geography;

population;

reference period;

period dates;

adjustment status;

reported change;

comparability note;

page number;

table label;

verifying person and time.

The AI must never invent or manually type display values.

The server must insert verified values into answers and drafts.

Use the source’s reported change rather than calculating a difference from rounded display values.

Guidelines

Implement versioned communication guidelines covering:

preferred terminology;

terms to avoid;

tone;

sentence length;

plain-language rules;

number formatting;

branding;

messaging rules.

Exactly one guideline version may be active.

Activating a new version must retire the previous version in the same transaction.

Every draft must record which guideline version shaped it.

Communication memory

Store and search:

approved media responses;

press releases;

official statements;

FAQs;

other approved organisational messaging.

Each item must include:

type;

title;

body;

topic;

audience;

communication date;

reference period;

origin;

approval basis;

reuse status;

evidence.

Support these reuse states:

reusable;

needs review;

historical only;

withdrawn.

An ordinary successful AI conversation must never automatically become approved memory.

Insights and decision record

Create:

/staff/insights

/staff/record

Insights must show measured values from real records:

most-asked topics;

answer outcomes;

knowledge gaps;

recent unanswered examples;

media turnaround time;

average and median turnaround;

stated time windows.

Clearly label demonstration seed data.

The decision record must show:

who drafted;

who edited;

who approved;

who released;

which version;

which sources;

which guideline version;

when each action occurred.

Do not display invented accuracy, savings or capacity figures.

Sarkimota conversational presentation pattern

Sarkimota is the primary interaction reference for how an AI conversation changes the visible interface in real time.

In Sarkimota’s Amina experience:

the conversation begins as the central interface;

the assistant produces structured conversation and presentation state;

when a relevant vehicle is discussed, the page transitions into a split layout;

the conversation remains visible;

a product panel displays the actual vehicle, image and relevant information;

sections and bullets change as the conversation progresses;

the product remains visible while the same topic continues;

desktop uses a side-by-side presentation;

mobile uses a responsive stacked or sheet presentation.

Adapt that interaction pattern to Naledi’s complete Ask experience.

Sarkimota is a UI and interaction reference. It is not the architecture for the whole Naledi application.

Do not copy:

automotive data;

vehicle keyword matching;

hard-coded products;

externally guessed images;

its voice provider dependency;

its fragile partial-JSON parsing;

its dark luxury brand;

its business rules.

Naledi Evidence Canvas

When a question produces supporting content, smoothly transition the Ask experience into:

conversation on the left;

Evidence Canvas on the right.

On mobile:

keep the answer and transcript visible;

show evidence below the answer or in an accessible bottom sheet;

never cover the text input;

allow the user to expand, close and reopen evidence.

The Evidence Canvas must be able to display, as the conversation requires:

verified metric cards;

official quotations;

source documents;

publication covers or neutral document icons;

document title, date and page;

comparison tables;

accessible charts;

definitions;

methodology notes;

caveats;

period comparisons;

source lists;

follow-up actions;

clarification choices;

gap explanations;

case acknowledgements.

Keep displayed evidence visible while the conversation remains on the same subject. Update it when the user selects a new period, geography, publication or measure.

Preserve conversation history during layout changes.

Use purposeful animation and respect reduced-motion settings.

Safe structured AI output

Do not allow the AI to send arbitrary HTML, components, URLs, figures or chart data to the browser.

The AI may propose:

approved evidence IDs;

verified observation IDs;

intended presentation block types;

supported plain-language explanation;

grounded follow-up questions;

review-routing reason.

The server must:

validate the AI response against a strict schema;

reject unknown evidence IDs;

confirm source approval and audience;

resolve observations from the database;

insert verified values;

resolve document metadata and URLs;

verify unit, period, geography and population;

ensure each factual statement has evidence;

reject unsupported causal explanations;

store the answer and evidence links;

return a safe public response object.

Use a discriminated union for visual blocks, including:

official_quote

metric

comparison_table

chart

document

definition

caveat

clarification

gap

case_acknowledgement

follow_up_actions

The React client must render only known block types.

Do not parse incomplete streamed JSON in the browser. Rich blocks may appear only after the complete structure is validated and resolved by the server.

Text may show an appropriate loading or progressive state while validation completes.

Statistical visualisation rules

Charts must use only verified observations returned by the server.

Every chart must:

agree with the prose and metric cards;

show units;

show periods;

show geography;

include an accessible data table;

show sources;

retain comparability warnings;

never invent missing data;

never imply a cause that the source does not state.

Charts are secondary to the approved Must journeys. Implement the reusable chart capability, but complete sourced answers, media review and security before spending time on chart polish.

Voice

Typing must provide the complete experience.

If voice is included:

use push-to-talk;

show an obvious recording state;

show the transcript before sending;

allow transcript correction;

send the corrected text through the normal Ask Edge Function;

read aloud only the checked final answer;

hide voice gracefully when unsupported;

never auto-start the microphone;

never let a speech model produce different facts.

Do not add an avatar in this submission.

Database

Implement the approved schema from SCHEMA.md.

Required tables:

profiles

sources

source_versions

passages

observations

guidelines

answers

evidence_links

cases

drafts

approvals

releases

memory_items

audit_events

widget_sites

rate_counters

Required views:

review_queue

insight_topics

insight_gaps

insight_turnaround

decision_record

Use the approved value lists, constraints, relationships, immutability rules, indexes and status transitions.

Do not replace this with a simplified generic schema.

Required functions

Build these public Supabase Edge Functions:

ask

escalate

media-query

case-status

Build these authenticated Edge Functions:

draft

ingest

Build transactional database functions for:

set_role

approve_source

reject_source

withdraw_source

activate_guidelines

open_case

assign_case

start_review

save_draft

request_changes

reject_case

approve_draft

release_draft

correct_routing

erase_contacts

Every privileged function must validate the authenticated user and role itself.

Public API

Create a versioned /v1 public contract and OpenAPI documentation.

Return the same answer record whether the caller is:

the main app;

the iframe widget;

an independent API client.

Document:

requests;

successful responses;

clarification;

gap;

escalation;

errors;

retry behavior;

rate limits;

API version.

Official blocks and AI explanation must be separate response fields.

Widget

Create a separate Vite library build that produces a small plain JavaScript widget.js.

The widget loader must:

add an assistant button to another website;

open /embed in an isolated iframe;

avoid style collisions;

accept site key, position, accent colour, language and opening text;

use verified postMessage origins;

support open, close, resize and ready messages;

give the iframe an accessible title;

move focus into the widget when opened;

return focus when closed;

close on Escape;

include allow="microphone" when voice is enabled;

open the standalone application as a fallback.

Create a separate demo-host page at a different origin or deployment address to prove the widget integration.

Security requirements

Implement all of these:

RLS enabled on every table in the first migration.

No anonymous direct table access.

Public access only through the approved Edge Functions.

Service-role and AI keys only in server secrets.

Staff roles read from server-controlled records.

Users cannot assign themselves roles.

Source status and audience filtered before retrieval.

Documents treated as untrusted content.

Drafts never returned publicly.

Staff-only sources never returned publicly.

Contact information never written to logs.

Private status token stored only as a hash.

Invalid token and missing case return the same refusal.

Public rate limiting.

Immutable audit events.

Transactional approval and release.

Demonstration identities and approvals clearly labelled.

Hosting region and AI provider disclosed.

No unsupported POPIA-compliance claim.

Required routes

Implement:

/

/embed

/media

/case/:ref

/developers

/staff/sign-in

/staff/review

/staff/review/:id

/staff/knowledge/sources

/staff/knowledge/guidelines

/staff/knowledge/memory

/staff/insights

/staff/record

All routes must have complete loading, empty, error, permission-denied and success states.

Design quality

Create a credible, polished South African public-sector information product.

Use:

navy;

teal;

white;

warm amber for decisions and warnings;

high contrast;

readable typography;

clear hierarchy;

generous spacing;

accessible tables;

visible focus;

keyboard navigation;

responsive mobile layouts;

light pages suitable for slow connections;

reduced-motion support.

The public Ask screen must immediately explain:

what the person can ask;

that answers use approved Stats SA information;

what is official;

what was AI-generated;

how to inspect a source;

how to contact an official.

Do not produce a generic admin template or a screen consisting only of chat bubbles.

Seed and demonstration data

Seed:

one communications official;

one knowledge administrator;

one communications manager;

QLFS Q1 2026;

QLFS Q2 2026;

the corresponding media release;

human-verified key observations;

five to eight public organisational sources or FAQs;

three to five real historical communications;

two or three demonstration-approved FAQ responses;

one active demonstration guideline version;

one widget site;

sample questions, gaps and media cases clearly labelled as demonstration data.

Do not load hackathon documents, transcripts or planning notes into the knowledge base.

Provide a reliable reset procedure.

Required test coverage

Implement and run the approved 30-case evaluation:

10 supported factual, publication, definition and organisational questions;

5 statistical or temporal traps;

5 media requests;

5 ambiguous or unsupported requests;

5 permission or adversarial requests.

Also test:

source withdrawal;

source correction;

approval invalidation after editing;

blocked unauthorised release;

blocked release using a withdrawn source;

status-token privacy;

anonymous table access;

staff role restrictions;

widget operation;

API client operation;

keyboard access;

mobile layout;

slow connection;

chart and table consistency.

Do not mark a test as passed unless it was executed successfully.

Build order

Build the application in this order:

React/Vite foundation and complete routing.

Supabase migrations, enums, tables, indexes and RLS.

Staff authentication and role enforcement.

Source ingestion, verified observations and source approval.

Ask pipeline and the full conversational Evidence Canvas.

Media intake, cases and private status.

Review workbench, draft versions, approval and release.

Guidelines and communication memory.

Source-change propagation.

Insights and decision record.

Widget, embed route, demo host and public API documentation.

Accessibility, security and evaluation tests.

Voice and chart polish only after the required workflows pass.

Definition of complete

This task is complete only when the following genuinely work end to end:

A public user asks a supported question and receives a referenced answer.

The conversation displays the correct evidence cards, source documents and table or chart.

An unsupported causal question produces an honest gap.

A media request receives acknowledgement only.

The request creates a private referenced draft.

A wrong-role release attempt fails.

Editing after approval removes approval.

An official approves and releases the exact current draft.

The journalist’s private page shows the released wording.

The released response enters communication memory.

A similar later query finds that memory.

Withdrawing a source flags affected records and blocks affected releases.

The widget works on the independent host page.

A sample client successfully uses the documented API.

Public callers cannot read staff tables or drafts.

Actual test results are recorded.

Start building now. Do not stop after explaining what you intend to build. Do not substitute mock buttons, local-only arrays or frontend role checks for working Supabase behavior. If an external AI credential is unavailable, implement the complete provider interface, validated server pipeline and deterministic demonstration provider so the full application remains testable, then clearly identify the credential needed to activate the production provider.)

note this is going to be a global app though starting from south africa, it must be global standard - appealing and pleasing in the eye, clean and professionally designed - gemini or elevenlab which would be the best for the voice-due to the local languages and dialects? 

here is the sarkimota for reference: https://github.com/emmacyril/sarkimota (https://sarkimota.vercel.app/) and https://github.com/emmacyril/sarkinmota-v2 (https://sarkinmotaapp.vercel.app/)

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a027beda-91da-4f1d-8078-5856beb67d46).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
