# StatBridge — Sarkimota interaction rebuild

## Understanding

Rebuild the public entry and Ask experience around the interaction actually used by Sarkimota, not merely its colours. The first screen will be a full-viewport two-door experience. The assistant side will feature a generated South African professional woman, react across the entire panel on hover and mouse-out, and open an immersive assistant room when either the portrait or “Start asking” is selected. The assistant room will preserve StatBridge’s typed-question-first workflow and verified Evidence Canvas, while adopting Sarkimota’s portrait-centred connecting, listening, speaking, ended, and return states. Both dark and light themes remain available.

## What the repository inspection confirmed

The two repositories use two related implementations:

- `sarkimota/src/pages/Entry.tsx` makes each half of the viewport the clickable target. Hover scales the half to `1.02`, reveals a radial glow, enlarges the portrait to `1.10`, and the microphone badge has its own scale/rotation response. Mouse-out reverses these transitions over roughly 500–700ms.
- `sarkimota/src/pages/Amina.tsx` opens a dedicated call screen with `connecting`, `listening`, `speaking`, and `disconnected` states, a timer, input/output volume, an end-call action, and “Talk Again / Enter Site” after ending.
- `sarkinmota-v2/src/pages/Landing.tsx` keeps landing and assistant modes in one stateful surface. Clicking the assistant half immediately changes the composition, starts the connection sequence, and centres the portrait visualiser. Its assistant can replace part of the screen with contextual content while the conversation remains active.
- Both use a near-black `#0A0A0A` page, a `#121212` assistant half, gold `hsl(43 55% 55%)`, a fine central divider, sparse copy, slow breathing motion, and a circular portrait surrounded by state-driven radial marks.
- The current StatBridge home only scales a small abstract mark, and `/ask` opens a conventional heading/cards/composer page. It does not currently have the portrait, whole-panel hover response, visual continuity, or assistant-state sequence shown in the screenshots.

## Build

### 1. Create the StatBridge assistant portrait

Generate one polished, photorealistic head-and-shoulders portrait of a South African business-class professional woman:

- approximately 35–45 years old, confident and warm;
- tailored charcoal or deep-black business suit with a restrained gold detail;
- natural, executive presentation suitable for a national statistics institution;
- direct eye contact, calm expression, neutral dark studio background;
- circular-crop safe, realistic skin texture, no text, no logos, no headset, no caricature.

Store it as a project asset and reuse the same portrait in every state so the identity never changes.

### 2. Match the two-door landing interaction

Replace the current dense landing content with the screenshot composition:

```text
┌─────────────────────────────┬─────────────────────────────┐
│                             │                             │
│       portrait + rings      │       Enter StatBridge →    │
│       Ask StatBridge        │       Media, cases & tools   │
│                             │                             │
└─────────────────────────────┴─────────────────────────────┘
```

- The whole left half is one accessible interactive target; portrait and “Start asking” trigger the same action.
- Rest: subtle breathing portrait and outer ring.
- Hover/focus: left half scales slightly, gold radial glow fades in, portrait zooms, image tint clears, rings brighten, mic badge lifts and rotates slightly.
- Mouse-out/blur: every property eases back cleanly with no jump.
- Press: a short compression state before opening `/ask`.
- The right half is one clean “Enter StatBridge →” target leading to the public desk/navigation surface; remove the four small dashboard-like cards from the gate.
- On phones, stack two equal-height doors and preserve the same touch feedback without relying on hover.

### 3. Rebuild `/ask` as the portrait-centred assistant room

The initial `/ask` view will visually continue from the landing portrait instead of reverting to an abstract mark and information cards.

States:

1. **Ready** — portrait centred with gold breathing rings; typed composer visible and focused; explicit voice button available.
2. **Connecting** — expanding concentric rings and “Connecting…” after the user explicitly starts voice.
3. **Listening** — radial marks react to microphone input; visible timer and stop/mute controls; live transcript fills the editable composer.
4. **Checking sources** — gold scanning ring with “Checking approved Stats SA sources…” while the normal safe Ask pipeline runs.
5. **Speaking** — portrait visualiser responds only while reading the final checked response; it never invents or alters facts.
6. **Ended/error** — portrait dims and shows “Session ended” with “Ask again” and “Return to StatBridge”.

Important safety reconciliation: Sarkimota requests microphone access immediately, but StatBridge’s approved requirements say voice is optional, typed questions are primary, and the microphone must never auto-start. Therefore, entering `/ask` will not trigger a permission prompt. Permission is requested only after the user presses the visible voice control. Clicking the portrait or “Start asking” opens the immersive room with the text field ready.

### 4. Keep conversation and Evidence Canvas inside that experience

- Remove the large introductory cards from the first Ask viewport; concise trust guidance remains accessible without competing with the portrait.
- Preserve the full question history and optimistic user turn.
- Answers continue to use separate official evidence and AI explanation treatments.
- When evidence exists, the assistant area shifts left and the Evidence Canvas enters from the right on desktop, matching Sarkimota’s contextual-product reveal.
- On mobile, evidence rises below the active answer as a controlled sheet and never covers the transcript or keyboard.
- Closing evidence restores the centred conversation; reopening it returns the same content.
- No browser parsing of partial structured JSON, no model-only facts, and media/sensitive requests still receive acknowledgement and a case reference only.

### 5. Build a dedicated portrait visualiser

Replace the abstract `AssistantMark` in the public assistant flow with a reusable portrait visualiser:

- circular image crop;
- dotted inner ring and low-opacity outer rings;
- connecting scan animation;
- input-driven listening marks;
- output-driven speaking marks;
- dimmed ended state;
- stable dimensions at every viewport to prevent layout shifts;
- keyboard-focus styling and descriptive status text;
- static equivalents when reduced motion is enabled.

The small abstract StatBridge mark may remain as the product logo in navigation, but it will no longer substitute for the assistant portrait.

### 6. Use the exact Sarkimota dark palette with a designed light counterpart

Dark mode will use the repository values verbatim for the primary stage:

- background `#0A0A0A`;
- assistant panel `#121212`;
- foreground `hsl(0 0% 96%)`;
- gold `hsl(43 55% 55%)` with the same light/dark gold range;
- hairline white borders at low opacity.

Light mode will preserve the same gold identity on warm white and soft neutral surfaces with accessible contrast. Keep Sora for display, Manrope for body, and JetBrains Mono for references/timers; remove forced uppercase from long headings and keep letter spacing at zero. The theme switch remains available but visually secondary.

## Files and modules

- Refactor the landing composition in `src/routes/index.tsx`.
- Refactor the immersive room shell in `src/routes/ask.tsx`.
- Add a focused assistant portrait/visualiser component under the StatBridge feature components.
- Refactor `AskExperience` to expose ready, listening, checking, speaking, and ended presentation states without changing its safe answer contract.
- Rework `VoiceInput` into explicit start/stop/mute controls that feed the shared visual state while leaving text primary.
- Retire the public-flow use of the abstract `AssistantMark`; retain it only where a compact product mark is appropriate.
- Adjust semantic theme and motion utilities in `src/styles.css`; no inline visual styling.
- Keep all backend, database, role, case, source-approval, answer-validation, and evidence contracts unchanged.

## Verification

- Compare the landing at desktop and phone sizes against the supplied screenshots.
- Verify rest → hover/focus → mouse-out/blur → press transitions for both halves.
- Verify portrait and “Start asking” open the same `/ask` state.
- Verify `/ask` does not request microphone access on page load.
- Verify explicit voice start requests permission and correctly reaches listening, stopped, denied, and error states.
- Verify typed Ask still works without microphone support.
- Verify conversation history remains present when evidence opens and closes.
- Verify desktop evidence split and mobile evidence sheet do not cover input or transcript.
- Verify dark/light themes, keyboard navigation, visible focus, reduced motion, and no text overflow.
- Check the preview at the user’s current 1052×772 viewport plus 390×844 and 1280×1800.
- Check the build and browser console before reporting completion.

## Out of scope for this correction

No database migration, seeding, staff workflow, public API, widget packaging, or business-rule change is included. This pass corrects the public landing and Ask interaction to the verified Sarkimota flow.
