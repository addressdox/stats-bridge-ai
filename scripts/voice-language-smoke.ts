/** Bounded speech/transcription checks. These are synthetic fixtures, not a native-speaker quality assessment. */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { synthesizeVoice, transcribeVoice } from "../src/lib/statbridge/voice.server";
const output = resolve(process.argv[2] || "../output/voice-validation");
mkdirSync(output, { recursive: true });
const fixtures = [
  ["en", "Hello. How can I help you today?"],
  ["af", "Goeiedag. Hoe kan ek jou vandag help?"],
  ["zu", "Sawubona. Ngingakusiza ngani namuhla?"],
  ["xh", "Molo. Ndingakunceda ngantoni namhlanje?"],
  ["nso", "Thobela. Nka go thuša bjang lehono?"],
  ["st", "Dumela. Nka o thusa jwang kajeno?"],
  ["tn", "Dumela. Nka go thusa jang gompieno?"],
  ["ss", "Sawubona. Ngingakusita ngani namuhla?"],
  ["ve", "Aa. Ndi nga ni thusa hani ṋamusi?"],
  ["ts", "Avuxeni. Ndingaku pfuna hi yini namuntlha?"],
  ["nr", "Lotjhani. Nginganisiza ngani namhlanjesi?"],
];
const results: unknown[] = [];
for (let offset = 0; offset < fixtures.length; offset += 3) {
  await Promise.all(
    fixtures.slice(offset, offset + 3).map(async ([language, text]) => {
      try {
        const voice = await synthesizeVoice(text!, language!);
        const bytes = new Uint8Array(await new Response(voice.body as BodyInit).arrayBuffer());
        writeFileSync(
          resolve(output, `${language}.${voice.contentType === "audio/wav" ? "wav" : "mp3"}`),
          bytes,
        );
        const transcript = await transcribeVoice(
          new Blob([bytes], { type: voice.contentType }),
          "auto",
        );
        const result = {
          language,
          fixture: text,
          speechBytes: bytes.byteLength,
          preview: voice.preview,
          transcript,
          languageMatched: transcript.language === language,
        };
        results.push(result);
        console.log(JSON.stringify(result));
      } catch (error) {
        const result = {
          language,
          fixture: text,
          error: error instanceof Error ? error.message : String(error),
        };
        results.push(result);
        console.log(JSON.stringify(result));
      }
    }),
  );
}
writeFileSync(
  resolve(output, "language-smoke.json"),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      note: "Synthetic greetings and model round-trip checks do not establish native speech recognition, pronunciation, or dialect quality. Nine languages are speech previews; no English substitution is applied.",
      results,
    },
    null,
    2,
  ),
);
