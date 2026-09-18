# StatBridge — design overhaul to match the Sarkimota reference

I opened both reference apps and read their source. You are right: what is on screen now
is a flat document-style page, not the experience in your reference. This plan replaces the
look and the interaction model of the public side. No backend, schema, rules or safety
behaviour changes.

## What the reference actually does

From sarkimota.vercel.app and sarkinmotaapp.vercel.app, and their code:

- A **split entry gate**, not a page of text. Left half: the assistant, a ringed portrait with
  a microphone badge, "Talk to Amina / Your AI automotive concierge". Right half: "Enter Site →".
  Two doors, full bleed, nothing else on the screen.
- **Near-black canvas** (#0A0A0A), one warm metallic accent, hairline borders, glass panels
  with heavy blur and deep shadow.
- **Display typography**: Titillium Web, uppercase, tight tracking for every heading; Inter for body.
- The conversation is **full screen and central**. When the assistant has something to show,
  a **canvas panel animates in** — a bottom sheet on mobile, a centred glass panel on desktop —
  with its own close button, and the conversation stays alive underneath.
- **Live motion**: an audio visualiser driven by input and output volume, a call timer, a mute
  control, and Motion (framer) transitions on every entry and exit.

## What I will build

### 1. Entry gate at `/`
Full-bleed split screen, no header, no footer. Left: "Ask StatBridge" with the animated
assistant mark and push-to-talk badge. Right: "Browse the desk →" leading to the media desk,
tracking, developers and staff sign-in. Collapses to stacked halves on a phone.

### 2. Ask as a full-screen room at `/ask`
Conversation centred and full height, chrome reduced to a thin top bar with status, mute and
close. The Evidence Canvas becomes a real canvas: a glass panel that animates in beside the
conversation on desktop and rises as a bottom sheet on a phone, with its own close and expand
controls, never covering the transcript or the keyboard. Evidence blocks (metric, quotation,
comparison table, chart, document, definition, caveat, gap, clarification, acknowledgement)
are redrawn as cards on that canvas, each carrying its official-versus-AI mark and its source line.

### 3. Voice presence
A live audio visualiser reacting to microphone level while you hold to speak and to playback
level while the checked answer is read back, plus an elapsed timer. Push-to-talk only, never
auto-started, hidden when the browser cannot do it.

### 4. Typography and motion
Display face with uppercase tight-tracked headings against a clean body face, matching the
reference's hierarchy. Motion on every panel entry, canvas open and close, and message arrival,
all disabled under reduced-motion.

### 5. Every other page reskinned
Media desk, case status, developers, embed widget and the staff pages all move onto the same
surface, spacing and card language so nothing looks like a stock admin template.

## One conflict you should decide on

The reference is near-black with gold. Your specification names **navy, teal, white and warm
amber** and asks for light pages on slow connections.

My proposal, unless you say otherwise: use a **deep navy-black** base (the reference's depth
and drama) with **teal** as the live/assistant accent and **warm amber** as the official-source
accent — so the palette is the one your specification names, rendered with the reference's
craft. A light theme stays available and the widget defaults to light so it sits correctly on
a Stats SA page. Say the word and I will go pure light or pure gold instead.

## Technical notes

- New: entry gate route, `/ask` room, `EvidenceCanvas` (desktop panel / mobile sheet),
  `AudioVisualizer`, `AssistantMark`, motion primitives.
- `src/styles.css` retokenised: surface ramp, hairline borders, glass, accent pair, display and
  body font links added in `__root.tsx` head.
- `motion` added for animation; existing `RenderBlock` block set kept as-is and restyled, so the
  typed answer contract, the server validation and every safety rule stay untouched.
- Unchanged: database, RLS, transactional functions, the four public doors, routing rules,
  acknowledgement-only handling for media.

## After this
Back to the remaining build: review workbench, knowledge base pages, insights, decision record,
seed data, widget build and the 30-case evaluation — all on the new surface.
