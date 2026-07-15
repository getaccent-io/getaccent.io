#!/usr/bin/env node
// Generates the HVPT minimal-pair audio bank with macOS TTS (`say`) across
// several voices. PLACEHOLDER for ElevenLabs: same file layout, so swapping
// providers later only means regenerating.
//
// HVPT needs many different speakers per word — that's the "high
// variability" that makes the training work. One voice would defeat it.
//
// Usage: npm run gen:hvpt   (macOS only; commits ~5MB of m4a to public/)
// Output: public/audio/drills/hvpt/{track}/{word}__{voice}.m4a + manifest.json

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, "public", "audio", "drills", "hvpt");

// Tracks are duplicated from src/constants/minimalPairs.ts (this script runs
// under plain node, no TS). Keep in sync when adding pairs.
const TRACKS = {
  "r-l": ["right", "light", "read", "lead", "rock", "lock", "road", "load", "pray", "play", "crowd", "cloud", "arrive", "alive", "correct", "collect"],
  "f-p": ["fan", "pan", "fine", "pine", "fork", "pork", "fair", "pair", "fool", "pool", "coffee", "copy", "fast", "past", "fill", "pill"],
  "v-b": ["vest", "best", "van", "ban", "very", "berry", "vote", "boat", "vase", "base", "vow", "bow", "curve", "curb", "marvel", "marble"],
  "th-s": ["think", "sink", "thank", "sank", "thick", "sick", "mouth", "mouse", "path", "pass", "faith", "face", "theme", "seem", "worth", "worse"],
};

// Preferred natural-ish US voices; whichever of these exist get used.
const CANDIDATE_VOICES = ["Samantha", "Eddy", "Flo", "Reed", "Sandy", "Shelley", "Fred", "Grandma", "Grandpa"];
const MAX_VOICES = 6;

function voiceWorks(voice) {
  try {
    execFileSync("say", ["-v", voice, "-o", "/tmp/hvpt-voice-test.aiff", "test"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const voices = CANDIDATE_VOICES.filter(voiceWorks).slice(0, MAX_VOICES);
if (voices.length < 3) {
  console.error(`Only ${voices.length} usable voices found — HVPT needs variability. Aborting.`);
  process.exit(1);
}
console.log(`Using voices: ${voices.join(", ")}`);

rmSync(outRoot, { recursive: true, force: true });
let count = 0;

for (const [trackId, words] of Object.entries(TRACKS)) {
  const dir = join(outRoot, trackId);
  mkdirSync(dir, { recursive: true });
  for (const word of words) {
    for (const voice of voices) {
      const aiff = join(dir, `${word}__${voice}.aiff`);
      const m4a = join(dir, `${word}__${voice}.m4a`);
      execFileSync("say", ["-v", voice, "-o", aiff, word]);
      execFileSync("afconvert", ["-f", "m4af", "-d", "aac", aiff, m4a], { stdio: "pipe" });
      rmSync(aiff);
      count++;
    }
  }
  console.log(`${trackId}: ${words.length} words × ${voices.length} voices`);
}

writeFileSync(
  join(outRoot, "manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      provider: "macos-say (placeholder for ElevenLabs)",
      voices,
      tracks: Object.fromEntries(Object.entries(TRACKS).map(([id, words]) => [id, words])),
    },
    null,
    2,
  ),
);
console.log(`\n${count} files written to public/audio/drills/hvpt/`);
