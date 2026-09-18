# Real-time voice agent, multilingual speech, and Gemini for text

Three changes: make the voice call answer in real time through a proper ElevenLabs voice agent, let callers speak South African languages, and move the written answers and meaning-based search onto your own Gemini key.

## 1. Why the voice call is slow today

Right now a call runs as four waits in a row: the browser listens and only sends the sentence when you stop talking, the server thinks with a heavy reasoning model, the whole answer is written before a single word is spoken, and only then is the audio fetched and played. Each step waits for the one before it, so a reply can take many seconds.

## 2. Real-time voice agent (ElevenLabs)

Replace the record-then-answer loop with a live voice agent the caller is genuinely in conversation with, over a real-time connection:

- Naledi greets, listens and speaks continuously; the caller can interrupt her mid-sentence.
- The moment a question is understood she says a short natural holding phrase ("Let me check that in the published figures") while the answer is being checked, so there is never dead air.
- The checked answer is spoken as it arrives rather than after it is fully written.

The safety rule is kept. The agent cannot invent statistics: it can only obtain figures by calling our checked-answer service, which runs the same approved-source pipeline used on the website. She may phrase and translate naturally, but every figure, publication, period and page comes from that checked answer. If the service returns no supported answer, she says so and offers to send it to an official — she never fills the gap herself.

Media, sensitive, judgement and low-confidence requests behave exactly as they do today: acknowledgement and a case reference only, no substantive spoken answer.

The agent also keeps the memory work already built: it captures name and contact details in conversation, recognises returning callers, records the whole conversation with its analysis, and can hand over to a person, which appears live in the staff desk.

## 3. South African languages

Best available per language, as you chose:

- Understanding: the agent understands callers speaking any South African language, including Zulu, Xhosa, Sotho, Afrikaans and English.
- Speaking: where a natural voice exists for the language, she answers in it. Where the voice service cannot speak a language properly, she answers in that language on screen and speaks in English, and says so once, politely.
- The caller can ask to switch language at any point.

I will confirm which languages actually speak well by testing each one, and report exactly what works rather than promising all eleven.

## 4. Learning and improvement

Every call is transcribed, analysed and stored as it already is for chat. On top of that, questions the agent could not answer become recorded gaps in the knowledge base, feeding the crawler and the staff review queue — so coverage improves with use. Returning callers are greeted by name with their past requests available.

## 5. Written answers and search on your Gemini key

- Written (chat) answers move to Gemini 3.8 on your own API key. This is also a large speed gain over the current reasoning model.
- Meaning-based search moves to Gemini embeddings on the same key. Existing stored embeddings are rebuilt once so old and new match.
- The key is stored server-side only and never reaches the browser. I will request it securely before starting.
- If your key is ever rejected or out of quota, the app says so plainly instead of failing silently.

## 6. Verification

I will place a real call and report measured timings: time to the holding phrase, time to the first spoken word of the answer, and total time. I will test one question in each language and one deliberately unsupported question to confirm the safe fallback, and report what I actually observe.

## Technical notes

- ElevenLabs Conversational AI agent, provisioned via the ElevenLabs API using the connected account; WebRTC session from the browser with a short-lived conversation token minted server-side (no key in the browser).
- Agent configured with the StatBridge persona, multilingual ASR, per-language voice mapping with English speech fallback, and a server tool `answer_question` pointed at a new endpoint wrapping the existing validated pipeline; plus tools for case status, media intake, contact capture and human handover, all at visitor permission level only.
- Tool endpoint authenticated by a shared secret header; returns the validated answer text plus evidence references.
- `VoiceCall.tsx` rewritten around `@elevenlabs/react` `useConversation`; microphone permission still only after an explicit gesture; existing conversation, turn-logging and handoff server functions reused.
- Chat provider switched to `gemini-3.8-flash` and embeddings to Gemini on `GEMINI_API_KEY`; one embedding backfill run.
