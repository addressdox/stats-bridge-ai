# Kaya voice upgrade — Cape Town South African identity

Upgrade only the ElevenLabs agent’s voice, pronunciation, language behaviour and spoken identity. Keep every existing StatBridge capability, evidence rule, tool, memory, contact capture, case flow and human handover unchanged.

## 1. Replace the current narration voice

The current agent is using “Naledi — Clear and Concise.” ElevenLabs labels it South African English, but it is designed primarily for narration and broadcast delivery rather than a natural Cape Town conversation.

- Use ElevenLabs Voice Design to create several adult female voice candidates specifically described as native Cape Town South African English, aged roughly 30–40, with a light natural Afrikaans influence.
- Generate the candidates from the same representative script: greeting, ordinary conversation, South African names and places, decimal statistics, dates, a formal media response and a short Afrikaans/code-switched passage.
- Compare the candidates for recognisable local vowels and rhythm, conversational warmth, pronunciation consistency, clarity and low-latency suitability.
- Save the strongest candidate as **Kaya — From the Mother City** and assign it to the existing ElevenLabs agent. Do not replace the agent or disconnect any of its tools.

## 2. Give Kaya the requested spoken identity

Update the agent’s voice instructions and first greeting so Kaya consistently sounds like a warm Cape Town woman rather than a generic international assistant.

- Contemporary Cape Town South African English by default; warm, attentive, confident and understated.
- Relaxed conversational pacing, natural pauses, varied sentence lengths and comfortable mid-range delivery.
- No American, British or Australian drift; no theatrical accent, announcer voice or cultural caricature.
- Recognise local expressions such as “Aweh,” “Howzit,” “Lekker,” “Eish,” “Now-now,” “Sharp sharp” and “Duidelik,” but use them sparingly and only when the caller’s tone makes them appropriate.
- Keep formal and sensitive conversations neutral and precise.
- Change the spoken identity from Naledi to Kaya wherever callers see or hear the voice agent, while leaving StatBridge’s purpose and workflows unchanged.

## 3. Improve South African pronunciation

Create and attach an ElevenLabs pronunciation dictionary for recurring South African names, places and domain terms.

- Start with Stats SA, Statistics South Africa, South Africa’s provinces, major metros, common local place names, official publication abbreviations and StatBridge-specific terms.
- Include the local expressions named in the brief and pronunciation-sensitive Afrikaans/isiXhosa words used by the agent.
- Keep written text normally spelled; pronunciation rules affect speech only.
- Record user corrections to names in conversation memory and instruct Kaya to follow the caller’s pronunciation thereafter.

## 4. Honest multilingual behaviour

- Preserve high-quality real-time recognition and natural code-switching.
- Follow explicit language requests and the caller’s established language without switching because of one borrowed word.
- Configure only languages the ElevenLabs agent can reliably understand and speak with the selected voice/model.
- Do not claim native speech for unsupported South African languages. Kaya will briefly explain the limitation and offer a reliably supported language instead.
- Afrikaans and every other target language will be tested separately; only verified speaking support will be presented as available.

## 5. Tune natural delivery without slowing the call

- Keep the existing real-time connection, interruption support and immediate holding response.
- Tune voice stability, similarity and speed for spontaneous conversation rather than audiobook narration.
- Keep short spoken sentences and natural contractions; avoid repetitive greetings, filler, forced laughter and excessive familiarity.
- Preserve the current evidence service: Kaya still obtains every statistic through the checked-answer tool and never invents figures.

## 6. Verify before release

- Audition the generated voice directly and place a browser call through the actual app.
- Test a greeting, a normal question, a long statistical answer, South African names and places, decimals, media escalation, human handover, interruption and code-switching.
- Test each requested language individually and report what is genuinely understood and what is genuinely spoken well.
- Confirm all five existing tools still work and that contact capture, memory, case references and handover records remain intact.
- Keep the previous voice configuration available for rollback until Kaya passes the checks.

## Technical details

- Generate candidates with ElevenLabs `POST /v1/text-to-voice/design`, save the selected voice, then patch only the existing agent’s TTS voice and spoken-prompt settings through `PATCH /v1/convai/agents/{agent_id}`.
- Use an ElevenLabs conversational model compatible with the selected voice, low latency and the required pronunciation rules.
- Create pronunciation rules through the ElevenLabs pronunciation-dictionary API and attach them to the agent.
- Preserve the agent ID, tool IDs, tool authentication, server endpoints, Gemini-backed checked-answer pipeline and visitor-level permissions.
- Update the app’s voice-facing label/transcript identity to Kaya without changing the written assistant’s factual policy or feature set.
