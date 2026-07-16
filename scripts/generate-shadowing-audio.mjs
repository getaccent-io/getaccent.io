#!/usr/bin/env node
// Generates the shadowing audio bank: one mp3 per library sentence, one
// consistent narrative voice per accent (unlike HVPT, shadowing wants a
// stable model to imitate, not voice variability).
//
// Reads src/constants/shadowingLibrary.json (build-shadowing-library.mjs).
// Azure-only for now — same keys as the assessment; ElevenLabs would slot in
// exactly like scripts/generate-hvpt-audio.mjs's provider table.
//
// Usage: npm run gen:shadowing [-- --accent us|uk] [-- --voice JennyNeural]
// One accent per run. ~1.3k words per accent — pennies.
//
// Output: public/audio/shadowing/{accent}/{passageId}/{index}.mp3
//         + {accent}/manifest.json (voice + per-passage sentence counts, so
//         the player can detect a stale bank after library edits).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
} catch {}
const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION;
if (!KEY || !REGION) {
  console.error("Needs AZURE_SPEECH_KEY + AZURE_SPEECH_REGION in .env.local");
  process.exit(1);
}

const { values: args } = parseArgs({
  options: {
    accent: { type: "string", default: "us" },
    voice: { type: "string" },
  },
});
if (args.accent !== "us" && args.accent !== "uk") {
  console.error(`Unknown accent "${args.accent}" — options: us, uk`);
  process.exit(1);
}
const accent = args.accent;
const locale = accent === "uk" ? "en-GB" : "en-US";
const DEFAULT_VOICE = { us: "JennyNeural", uk: "SoniaNeural" };
const voiceName = `${locale}-${(args.voice ?? DEFAULT_VOICE[accent]).replace(/^en-(US|GB)-/, "")}`;

const library = JSON.parse(readFileSync(join(root, "src", "constants", "shadowingLibrary.json"), "utf8"));

async function withRetry(label, fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.permanent || attempt >= 3) throw err;
      const wait = 1500 * attempt * attempt;
      console.warn(`  retrying ${label} in ${wait}ms — ${err.message ?? err}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

const escapeXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function synth(text) {
  const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
      "User-Agent": "getaccent-gen-shadowing",
    },
    body: `<speak version='1.0' xml:lang='${locale}'><voice name='${voiceName}'>${escapeXml(text)}</voice></speak>`,
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    err.permanent = res.status !== 429 && res.status < 500;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}

const outDir = join(root, "public", "audio", "shadowing", accent);
rmSync(outDir, { recursive: true, force: true });
console.log(`Accent: ${accent} — voice: ${voiceName}`);

let count = 0;
for (const passage of library.passages) {
  const dir = join(outDir, passage.id);
  mkdirSync(dir, { recursive: true });
  const jobs = passage.sentences.map((text, i) => ({ text, i }));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < jobs.length) {
        const { text, i } = jobs[cursor++];
        const bytes = await withRetry(`${passage.id}/${i}`, () => synth(text));
        writeFileSync(join(dir, `${i}.mp3`), bytes);
        count++;
      }
    }),
  );
  console.log(`${passage.id}: ${passage.sentences.length} sentences`);
}

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      accent,
      voice: voiceName,
      ext: "mp3",
      passages: Object.fromEntries(library.passages.map((p) => [p.id, p.sentences.length])),
    },
    null,
    2,
  ),
);
console.log(`\n${count} files written to public/audio/shadowing/${accent}/`);
