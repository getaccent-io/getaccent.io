#!/usr/bin/env node
// Builds src/lib/scoring/ukPhonemeNames.json — the template that re-attaches
// phoneme names to en-GB assessment results (Azure only names phonemes for
// en-US; en-GB returns scored but nameless slots).
//
// Method, per word: get the named SAPI sequence from a real en-US assessment
// (passage words in sentence context, drill words in citation form), then
// verify the slot COUNT against a real en-GB assessment of native UK TTS.
// Counts usually match; where en-GB has one extra slot it splits a US "er"
// into vowel + r (e.g. curve: k er v → k er r v), so we expand "er" until
// lengths agree. Words that still don't line up are left out of the template
// — the app then simply skips phoneme-level analysis for them.
//
// Usage: node scripts/build-uk-phoneme-names.mjs   (needs Azure keys; ~2 min)
// Rerun whenever the passage or the drill word list changes.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

// Duplicated from src/constants/passages.ts — keep in sync.
const PASSAGE =
  "When the sunlight strikes raindrops in the air, they act as a prism and form a rainbow. " +
  "The rainbow is a division of white light into many beautiful colors. " +
  "These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon. " +
  "There is, according to legend, a boiling pot of gold at one end. " +
  "People look, but no one ever finds it.";

// Duplicated from src/constants/minimalPairs.ts — keep in sync.
const DRILL_WORDS = [
  "right", "light", "read", "lead", "rock", "lock", "road", "load", "pray", "play", "crowd", "cloud", "arrive", "alive", "correct", "collect",
  "fan", "pan", "fine", "pine", "fork", "pork", "fair", "pair", "fool", "pool", "coffee", "copy", "fast", "past", "fill", "pill",
  "vest", "best", "van", "ban", "very", "berry", "vote", "boat", "vet", "bet", "vow", "bow", "curve", "curb", "marvel", "marble",
  "think", "sink", "thank", "sank", "thick", "sick", "mouth", "mouse", "path", "pass", "faith", "face", "theme", "seem", "worth", "worse",
];

const VOICE = { "en-US": "en-US-JennyNeural", "en-GB": "en-GB-SoniaNeural" };

async function withRetry(label, fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.permanent || attempt >= 4) throw err;
      const wait = 2000 * attempt;
      console.warn(`  retrying ${label} in ${wait}ms — ${err.message ?? err}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function tts(locale, text) {
  const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "riff-16khz-16bit-mono-pcm",
      "User-Agent": "getaccent-uk-template",
    },
    body: `<speak version='1.0' xml:lang='${locale}'><voice name='${VOICE[locale]}'>${text}</voice></speak>`,
  });
  if (!res.ok) {
    const err = new Error(`TTS ${locale}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    err.permanent = res.status !== 429 && res.status < 500;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}

async function assess(locale, wav, referenceText) {
  const cfg = Buffer.from(
    JSON.stringify({ ReferenceText: referenceText, GradingSystem: "HundredMark", Granularity: "Phoneme", EnableMiscue: true }),
  ).toString("base64");
  const res = await fetch(
    `https://${REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": KEY,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Pronunciation-Assessment": cfg,
        Accept: "application/json",
      },
      body: wav,
    },
  );
  const body = await res.json().catch(() => null);
  const words = body?.NBest?.[0]?.Words;
  if (!res.ok || !words) {
    const err = new Error(`PA ${locale}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    err.permanent = res.status !== 429 && res.status < 500;
    throw err;
  }
  return words;
}

/** [word, usNames[], gbSlotCount] triples for one reference text. */
async function analyze(referenceText, label) {
  const [usWords, gbWords] = await Promise.all([
    withRetry(`${label} en-US`, async () => assess("en-US", await tts("en-US", referenceText), referenceText)),
    withRetry(`${label} en-GB`, async () => assess("en-GB", await tts("en-GB", referenceText), referenceText)),
  ]);
  if (usWords.length !== gbWords.length) {
    throw new Error(`${label}: token count differs between locales (${usWords.length} vs ${gbWords.length})`);
  }
  return usWords.map((us, i) => {
    const gb = gbWords[i];
    if (us.Word.toLowerCase() !== gb.Word.toLowerCase()) {
      throw new Error(`${label}: token ${i} misaligned ("${us.Word}" vs "${gb.Word}")`);
    }
    return [us.Word.toLowerCase(), (us.Phonemes ?? []).map((p) => p.Phoneme.toLowerCase()), (gb.Phonemes ?? []).length];
  });
}

// en-GB has one slot more than en-US wherever US "er" covers vowel+r; expand
// the rightmost `need` occurrences of "er" to ["er", "r"].
function fitToCount(usNames, gbCount) {
  if (usNames.length === gbCount) return { names: usNames, how: "exact" };
  const need = gbCount - usNames.length;
  const erIdx = usNames.map((p, i) => (p === "er" ? i : -1)).filter((i) => i !== -1);
  if (need > 0 && need <= erIdx.length) {
    const split = new Set(erIdx.slice(-need));
    return { names: usNames.flatMap((p, i) => (split.has(i) ? ["er", "r"] : [p])), how: "er-split" };
  }
  return null;
}

const triples = [];
console.log("Analyzing passage (both locales)…");
triples.push(...(await analyze(PASSAGE, "passage")));
console.log(`Analyzing ${DRILL_WORDS.length} drill words (citation form)…`);
// Small pool — each word is 4 API calls (2 TTS + 2 PA).
let cursor = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < DRILL_WORDS.length) {
      const word = DRILL_WORDS[cursor++];
      triples.push(...(await analyze(word, word)));
    }
  }),
);

const words = {};
const report = { exact: 0, erSplit: 0, unmatched: [], conflicts: [] };
for (const [word, usNames, gbCount] of triples) {
  if (usNames.length === 0) continue;
  const fit = fitToCount(usNames, gbCount);
  if (!fit) {
    report.unmatched.push(`${word} (us ${usNames.length} [${usNames.join(" ")}] vs gb ${gbCount})`);
    continue;
  }
  if (words[word]) {
    if (words[word].join(" ") !== fit.names.join(" ")) report.conflicts.push(word);
    continue; // first occurrence wins
  }
  words[word] = fit.names;
  report[fit.how === "exact" ? "exact" : "erSplit"]++;
}

const out = {
  generatedAt: new Date().toISOString(),
  note: "word -> SAPI-ish names for en-GB phoneme slots. Generated by scripts/build-uk-phoneme-names.mjs; do not edit by hand.",
  words: Object.fromEntries(Object.entries(words).sort(([a], [b]) => a.localeCompare(b))),
};
writeFileSync(join(root, "src", "lib", "scoring", "ukPhonemeNames.json"), JSON.stringify(out, null, 2) + "\n");

console.log(`\n${Object.keys(words).length} words in template — ${report.exact} exact count match, ${report.erSplit} er-split`);
if (report.conflicts.length) console.log(`context variants (first kept): ${report.conflicts.join(", ")}`);
if (report.unmatched.length) {
  console.log(`UNMATCHED (left out of template):\n  ${report.unmatched.join("\n  ")}`);
}
console.log("Written to src/lib/scoring/ukPhonemeNames.json");
