# StatBridge build roadmap

## Done

- [x] Database: 26 enums, 16 tables, indexes, immutability triggers
- [x] RLS on every table; no direct table access for anonymous callers
- [x] 15 transactional decision functions (approve, release, withdraw, etc.)
- [x] 5 read-only views (review queue, insights x3, decision record)
- [x] Private `sources` storage bucket, administrator-only policies
- [x] Email sign-in enabled for staff
- [x] Design system (navy / teal / amber, official vs AI distinction)
- [x] Typed public answer contract (`src/lib/statbridge/contract.ts`)

## In progress

- [ ] Server pipeline: retrieval, validation, safe block assembly, AI provider
- [ ] Public server functions: ask, escalate, media-query, case-status

## Planned

- [ ] Ask screen + Evidence Canvas (Sarkimota pattern)
- [ ] Media Desk `/media`, private case status `/case/:ref`
- [ ] Staff sign-in, review queue and workbench, approval and release
- [ ] Knowledge base: sources, guidelines, communication memory
- [ ] Insights `/staff/insights` and decision record `/staff/record`
- [ ] Widget build, `/embed` route, independent demo host, `/developers` API docs
- [ ] Seed demonstration data + reset procedure
- [ ] 30-case evaluation and supplementary tests, results recorded
- [ ] Voice (push-to-talk) and chart polish

## Questions raised by the user

- [x] Gemini vs ElevenLabs for voice — answered: Gemini for understanding SA
      languages; browser speech as the no-cost fallback.
- [ ] Progress report requested 18 Sep — answer with the status above.
