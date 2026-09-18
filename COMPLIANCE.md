# Naledi by AddressDox — compliance and assurance notes

## Sourcing
- Every figure or quotation in a public answer comes from an approved publication version. The assistant may propose only record identifiers; the server resolves them and discards anything unsupported.
- Only South African official publishers may be captured: HTTPS addresses on `gov.za`, `statssa.gov.za` and `resbank.co.za`, revalidated after redirects. Questions about other countries return a stated gap.
- A publication becomes searchable only after extraction succeeds, passages exist, every extracted figure has been checked by a person, and an authorised officer approves it. Corrections keep the earlier version in the history and flag any answer that relied on it.

## Human review rules (verified end to end)
Routing is deterministic and applied before the assistant is called. Media, sensitive, official-position, causal, judgement, complex and adversarial requests are logged as a case and receive a reference only — never AI-written wording. Verified by running a live question set through the public endpoint:

| Question type | Result |
| --- | --- |
| Three factual figure questions | Answered with cited approved sources |
| Journalist asking for comment | Referred to a person, acknowledgement only |
| "Why is unemployment rising?" | Referred to a person |
| "Is government failing on poverty?" | Referred to a person |
| Question about another country | Stated gap, no answer |
| Vague one-word question | Clarifying question |

## Privacy (POPIA)
- Contact details are stored only with consent, and media case contacts are erased automatically 90 days after the case is opened.
- Visitor retention is a desk setting; the private case link uses a hashed token, so a reference alone reveals nothing.
- The service key and the AI provider key never leave the server.

## Audit
- `audit_events` is append-only, enforced by a database trigger: no update, no delete.
- Every approval, rejection, withdrawal, guideline activation, role change, release and website registration writes an audit entry with actor, before and after state.
- The decision record shows, for each released reply, who drafted it, who approved which exact version, which sources it rested on and which house style was in force.

## Access control
- Permissions, not job titles, gate every action; roles are assignable and auditable.
- Privileged database routines are restricted to the service side. The routines that remain callable by a signed-in account each enforce their own permission check internally, and two role-lookup helpers must stay callable because the row-level security policies evaluate them as the calling account.
