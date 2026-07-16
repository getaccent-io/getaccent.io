#!/usr/bin/env node
// Smoke test for the assessment pipeline with REAL audio.
// Synthesizes the Rainbow Passage with macOS TTS, converts it to the same
// 16kHz mono WAV the browser produces, and POSTs it to /api/assessment.
//
// Usage:  npm run smoke            (dev server must be running)
//         npm run smoke -- --url http://localhost:3000
//         npm run smoke -- --accent uk   (UK voice, en-GB assessment)
//
// In mock mode (no Azure keys) this proves the transport; with keys in
// .env.local it proves the whole Azure integration end-to-end.

import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PASSAGE =
  "When the sunlight strikes raindrops in the air, they act as a prism and form a rainbow. " +
  "The rainbow is a division of white light into many beautiful colors. " +
  "These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon. " +
  "There is, according to legend, a boiling pot of gold at one end. " +
  "People look, but no one ever finds it.";

const urlFlag = process.argv.indexOf("--url");
const baseUrl = urlFlag !== -1 ? process.argv[urlFlag + 1] : "http://localhost:3000";
const accentFlag = process.argv.indexOf("--accent");
const accent = accentFlag !== -1 ? process.argv[accentFlag + 1] : "us";
// A native voice of the target accent, so real-key runs should score high.
const voice = accent === "uk" ? "Daniel" : "Samantha";

const dir = mkdtempSync(join(tmpdir(), "azure-smoke-"));
const aiff = join(dir, "passage.aiff");
const wav = join(dir, "passage.wav");

try {
  console.log(`Synthesizing passage with macOS TTS (${voice}, accent=${accent})…`);
  execFileSync("say", ["-v", voice, "-o", aiff, PASSAGE]);
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", aiff, wav]);

  const audio = readFileSync(wav);
  console.log(`Posting ${(audio.length / 1024).toFixed(0)} KB WAV to ${baseUrl}/api/assessment…`);

  const form = new FormData();
  form.append("audio", new File([audio], "passage.wav", { type: "audio/wav" }));
  form.append("referenceText", PASSAGE);
  form.append("accent", accent);

  const res = await fetch(`${baseUrl}/api/assessment`, { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) {
    console.error(`FAILED (${res.status}):`, body.error);
    process.exit(1);
  }

  const { mode, profile } = body;
  console.log(`\nmode: ${mode}${mode === "mock" ? "  (no Azure keys — simulated scores)" : ""}`);
  const o = profile.overall;
  console.log(
    `overall ${o.pronScore}  accuracy ${o.accuracy}  fluency ${o.fluency}  completeness ${o.completeness}  prosody ${o.prosody ?? "—"}`,
  );
  for (const f of profile.findings) {
    console.log(`- ${f.label}: ${f.detected ? `DETECTED (severity ${f.severity})` : "ok"} — ${f.summary}`);
  }
  if (profile.recommendations.length > 0) {
    console.log("Recommended drills (weakest first):");
    for (const r of profile.recommendations) {
      console.log(`  ${r.trackLabel} — ${r.reason} (in: ${r.exampleWords.join(", ")})`);
    }
  }
  if (mode === "azure") {
    console.log(
      "\nNote: this is a native-quality TTS voice, so scores should be high.",
      "\nLow scores here would mean an audio-pipeline problem, not a bad accent.",
    );
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
