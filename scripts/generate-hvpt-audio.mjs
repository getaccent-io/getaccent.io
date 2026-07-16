#!/usr/bin/env node
// Generates the HVPT minimal-pair audio bank across several voices.
// Provider-pluggable: the app never sees the provider — its only contract is
// public/audio/drills/hvpt/{track}/{word}__{voice}.<ext> + manifest.json
// (which carries the voice list and file extension), so switching TTS vendors
// means rerunning this script, nothing else.
//
// HVPT needs many different speakers per word — that's the "high
// variability" that makes the training work. One voice would defeat it.
//
// Usage: npm run gen:hvpt [-- --accent us|uk] [-- --provider elevenlabs|azure|google|macos]
//                         [-- --voices Jenny,Guy,...] [-- --max-voices 6]
// Each run regenerates ONE accent's bank (default us); the app picks the
// bank matching the user's accent toggle. Without --provider, uses the first
// of elevenlabs / azure / google whose keys are in .env.local, else falls
// back to macos (`say`, placeholder quality). Keys: ELEVENLABS_API_KEY,
// AZURE_SPEECH_KEY + AZURE_SPEECH_REGION, GOOGLE_TTS_API_KEY. One accent's
// bank is ~2.5k characters of TTS — pennies on any provider (fits
// ElevenLabs' free tier).
//
// Output: public/audio/drills/hvpt/{accent}/{track}/{word}__{voice}.mp3
// (.m4a for macos) + {accent}/manifest.json — ~4MB per accent in public/.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, "public", "audio", "drills", "hvpt");

// Cloud keys live in .env.local (gitignored). No dotenv dep; real env wins.
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
} catch {}

// Tracks are duplicated from src/constants/minimalPairs.ts (this script runs
// under plain node, no TS). Keep in sync when adding pairs — and remember
// every pair must hold in BOTH accents (see note in minimalPairs.ts).
//
// Heteronym watch: "read"/"lead" (r-l) and "bow" (v-b) each have two
// pronunciations. A TTS picking the wrong one keeps the consonant contrast
// but leaks a vowel cue — and in the speaking drill the model would fight the
// pronunciation Azure expects when scoring. Spot-listen those after a regen.
const TRACKS = {
  "r-l": ["right", "light", "read", "lead", "rock", "lock", "road", "load", "pray", "play", "crowd", "cloud", "arrive", "alive", "correct", "collect"],
  "f-p": ["fan", "pan", "fine", "pine", "fork", "pork", "fair", "pair", "fool", "pool", "coffee", "copy", "fast", "past", "fill", "pill"],
  "v-b": ["vest", "best", "van", "ban", "very", "berry", "vote", "boat", "vet", "bet", "vow", "bow", "curve", "curb", "marvel", "marble"],
  "th-s": ["think", "sink", "thank", "sank", "thick", "sick", "mouth", "mouse", "path", "pass", "faith", "face", "theme", "seem", "worth", "worse"],
};

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

async function fetchBytes(url, init, label) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = new Error(`${label}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    // 429/5xx are worth retrying; auth/bad-request failures are not.
    err.permanent = res.status !== 429 && res.status < 500;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}

// Each provider: ext, concurrency, hasKeys/keysHint, resolveVoices(names?,
// max, accent) -> [{label, ref}] (label = filename + manifest entry, ref =
// what the API wants), synth(word, voice) -> audio bytes. Declaration order
// is the default-provider preference order.
const PROVIDERS = {
  elevenlabs: {
    ext: "mp3",
    concurrency: 2, // free-tier cap on concurrent requests
    hasKeys: () => !!process.env.ELEVENLABS_API_KEY,
    keysHint: "ELEVENLABS_API_KEY",
    async resolveVoices(names, max, accent) {
      const headers = { "xi-api-key": process.env.ELEVENLABS_API_KEY };
      const list = JSON.parse(
        (await withRetry("voice list", () => fetchBytes("https://api.elevenlabs.io/v1/voices", { headers }, "voice list"))).toString("utf8"),
      ).voices;
      if (names) {
        return names.map((n) => {
          const v = list.find((v) => v.name.toLowerCase() === n.toLowerCase());
          if (!v) throw new Error(`ElevenLabs voice "${n}" not in your voice library (have: ${list.map((v) => v.name).join(", ")})`);
          return { label: v.name.replace(/[^A-Za-z0-9-]/g, ""), ref: v.voice_id };
        });
      }
      // Default: accent-matching voices from the account library,
      // alternating female/male so the bank stays balanced.
      const wanted = accent === "uk" ? "british" : "american";
      const match = list.filter((v) => (v.labels?.accent ?? "").toLowerCase().includes(wanted));
      const female = match.filter((v) => v.labels?.gender === "female");
      const male = match.filter((v) => v.labels?.gender !== "female");
      const picked = [];
      for (let i = 0; picked.length < max && (female[i] || male[i]); i++) {
        for (const v of [female[i], male[i]]) if (v && picked.length < max) picked.push(v);
      }
      return picked.map((v) => ({ label: v.name.replace(/[^A-Za-z0-9-]/g, ""), ref: v.voice_id }));
    },
    synth(word, voice) {
      return fetchBytes(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice.ref}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" },
          body: JSON.stringify({ text: word, model_id: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2" }),
        },
        `${word}/${voice.label}`,
      );
    },
  },

  azure: {
    ext: "mp3",
    concurrency: 3,
    hasKeys: () => !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
    keysHint: "AZURE_SPEECH_KEY + AZURE_SPEECH_REGION",
    // Long-stable neural voices per accent, alternating female/male. Same
    // keys as the assessment API — no extra signup.
    curated: {
      us: ["Jenny", "Guy", "Aria", "Davis", "Sara", "Tony"],
      uk: ["Sonia", "Ryan", "Libby", "Thomas", "Hollie", "Elliot"],
    },
    async resolveVoices(names, max, accent) {
      const locale = accent === "uk" ? "en-GB" : "en-US";
      return (names ?? this.curated[accent].slice(0, max)).map((n) => ({
        label: n.replace(/^en-(US|GB)-/, "").replace(/Neural$/, ""),
        ref: n.startsWith("en-") ? n : `${locale}-${n}Neural`,
      }));
    },
    synth(word, voice) {
      return fetchBytes(
        `https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
            "User-Agent": "getaccent-gen-hvpt",
          },
          body: `<speak version='1.0' xml:lang='en-US'><voice name='${voice.ref}'>${word}</voice></speak>`,
        },
        `${word}/${voice.label}`,
      );
    },
  },

  google: {
    ext: "mp3",
    concurrency: 4,
    hasKeys: () => !!process.env.GOOGLE_TTS_API_KEY,
    keysHint: "GOOGLE_TTS_API_KEY (project with Cloud Text-to-Speech API enabled)",
    // Chirp 3 HD voices (same persona names exist per locale), alternating
    // female/male.
    curated: ["Aoede", "Puck", "Kore", "Charon", "Leda", "Fenrir", "Zephyr", "Orus"],
    async resolveVoices(names, max, accent) {
      const locale = accent === "uk" ? "en-GB" : "en-US";
      return (names ?? this.curated.slice(0, max)).map((n) => ({
        label: n.includes("-") ? n.split("-").pop() : n,
        ref: n.includes("-") ? n : `${locale}-Chirp3-HD-${n}`,
      }));
    },
    async synth(word, voice) {
      const body = await fetchBytes(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            input: { text: word },
            voice: { languageCode: "en-US", name: voice.ref },
            audioConfig: { audioEncoding: "MP3" },
          }),
        },
        `${word}/${voice.label}`,
      );
      return Buffer.from(JSON.parse(body.toString("utf8")).audioContent, "base64");
    },
  },

  macos: {
    ext: "m4a",
    concurrency: 1,
    hasKeys: () => process.platform === "darwin",
    keysHint: "macOS (uses the built-in `say` command)",
    curated: {
      us: ["Samantha", "Eddy", "Flo", "Reed", "Sandy", "Shelley", "Fred", "Grandma", "Grandpa"],
      uk: ["Daniel", "Kate", "Serena", "Stephanie", "Jamie", "Oliver"],
    },
    async resolveVoices(names, max, accent) {
      const usable = (names ?? this.curated[accent]).filter((v) => {
        try {
          execFileSync("say", ["-v", v, "-o", "/tmp/hvpt-voice-test.aiff", "test"], { stdio: "pipe" });
          return true;
        } catch {
          return false;
        }
      });
      return usable.slice(0, max).map((v) => ({ label: v, ref: v }));
    },
    async synth(word, voice) {
      const base = join(tmpdir(), `hvpt-${word}-${voice.label}`);
      try {
        execFileSync("say", ["-v", voice.ref, "-o", `${base}.aiff`, word]);
        execFileSync("afconvert", ["-f", "m4af", "-d", "aac", `${base}.aiff`, `${base}.m4a`], { stdio: "pipe" });
        return readFileSync(`${base}.m4a`);
      } finally {
        rmSync(`${base}.aiff`, { force: true });
        rmSync(`${base}.m4a`, { force: true });
      }
    },
  },
};

const { values: args } = parseArgs({
  options: {
    accent: { type: "string", default: "us" },
    provider: { type: "string" },
    voices: { type: "string" },
    "max-voices": { type: "string", default: "6" },
  },
});

if (args.provider && !PROVIDERS[args.provider]) {
  console.error(`Unknown provider "${args.provider}" — options: ${Object.keys(PROVIDERS).join(", ")}`);
  process.exit(1);
}
if (args.accent !== "us" && args.accent !== "uk") {
  console.error(`Unknown accent "${args.accent}" — options: us, uk`);
  process.exit(1);
}
const accent = args.accent;
const providerId = args.provider ?? Object.keys(PROVIDERS).find((id) => PROVIDERS[id].hasKeys()) ?? "macos";
const provider = PROVIDERS[providerId];
if (!provider.hasKeys()) {
  console.error(`Provider "${providerId}" unavailable — needs ${provider.keysHint} (put keys in .env.local).`);
  process.exit(1);
}
if (!args.provider) console.log(`No --provider given — using "${providerId}" (first with credentials).`);

const maxVoices = Math.max(3, Number(args["max-voices"]) || 6);
const voices = await provider.resolveVoices(args.voices?.split(",").map((s) => s.trim()), maxVoices, accent);
if (voices.length < 3) {
  console.error(`Only ${voices.length} usable voices found — HVPT needs variability. Aborting.`);
  process.exit(1);
}
console.log(`Accent: ${accent} — provider: ${providerId} — voices: ${voices.map((v) => v.label).join(", ")}`);

const outDir = join(outRoot, accent);
rmSync(outDir, { recursive: true, force: true });
let count = 0;

for (const [trackId, words] of Object.entries(TRACKS)) {
  const dir = join(outDir, trackId);
  mkdirSync(dir, { recursive: true });
  const jobs = words.flatMap((word) => voices.map((voice) => ({ word, voice })));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: provider.concurrency }, async () => {
      while (cursor < jobs.length) {
        const { word, voice } = jobs[cursor++];
        const bytes = await withRetry(`${trackId}/${word}__${voice.label}`, () => provider.synth(word, voice));
        writeFileSync(join(dir, `${word}__${voice.label}.${provider.ext}`), bytes);
        count++;
      }
    }),
  );
  console.log(`${trackId}: ${words.length} words × ${voices.length} voices`);
}

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      accent,
      provider: providerId,
      ext: provider.ext,
      voices: voices.map((v) => v.label),
      tracks: TRACKS,
    },
    null,
    2,
  ),
);
console.log(`\n${count} files written to public/audio/drills/hvpt/${accent}/`);
