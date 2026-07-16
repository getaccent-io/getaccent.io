#!/usr/bin/env node
// Builds src/constants/shadowingLibrary.json — the shadowing content library.
//
// Bible passages are fetched from bible-api.com in the World English Bible
// translation (public domain, modern English — NIV & co. would need a
// license). Classics are public-domain texts inlined below. Text is split
// into shadowing-sized sentences at bake time: Intl.Segmenter for sentence
// boundaries, then anything over ~130 chars splits at the clause break
// nearest its middle.
//
// Usage: node scripts/build-shadowing-library.mjs
// Rerun when adding passages, then `npm run gen:shadowing` for the audio.

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ref = bible-api.com reference (WEB translation); text = inline source.
const SPEC = [
  { id: "psalm-23", collection: "bible", title: "Psalm 23", source: "World English Bible", ref: "psalms 23" },
  { id: "psalm-121", collection: "bible", title: "Psalm 121", source: "World English Bible", ref: "psalms 121" },
  { id: "john-1", collection: "bible", title: "John 1:1–14", source: "World English Bible", ref: "john 1:1-14" },
  { id: "1-corinthians-13", collection: "bible", title: "1 Corinthians 13", source: "World English Bible", ref: "1 corinthians 13" },
  { id: "philippians-4", collection: "bible", title: "Philippians 4:4–13", source: "World English Bible", ref: "philippians 4:4-13" },
  {
    id: "north-wind",
    collection: "classics",
    title: "The North Wind and the Sun",
    source: "Aesop's Fables",
    text:
      "The North Wind and the Sun were disputing which was the stronger, when a traveler came along wrapped in a warm cloak. " +
      "They agreed that the one who first succeeded in making the traveler take his cloak off should be considered stronger than the other. " +
      "Then the North Wind blew as hard as he could, but the more he blew, the more closely did the traveler fold his cloak around him, and at last the North Wind gave up the attempt. " +
      "Then the Sun shined out warmly, and immediately the traveler took off his cloak. " +
      "And so the North Wind was obliged to confess that the Sun was the stronger of the two.",
  },
  {
    id: "gettysburg",
    collection: "classics",
    title: "The Gettysburg Address",
    source: "Abraham Lincoln, 1863",
    text:
      "Four score and seven years ago our fathers brought forth on this continent a new nation, conceived in liberty, and dedicated to the proposition that all men are created equal. " +
      "Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. " +
      "We are met on a great battlefield of that war. " +
      "We have come to dedicate a portion of that field as a final resting place for those who here gave their lives that that nation might live. " +
      "It is altogether fitting and proper that we should do this. " +
      "But, in a larger sense, we cannot dedicate, we cannot consecrate, we cannot hallow this ground. " +
      "The brave men, living and dead, who struggled here have consecrated it, far above our poor power to add or detract. " +
      "The world will little note, nor long remember, what we say here, but it can never forget what they did here. " +
      "It is for us the living, rather, to be dedicated here to the unfinished work which they who fought here have thus far so nobly advanced. " +
      "It is rather for us to be here dedicated to the great task remaining before us, that from these honored dead we take increased devotion to that cause for which they gave the last full measure of devotion, " +
      "that we here highly resolve that these dead shall not have died in vain, that this nation, under God, shall have a new birth of freedom, and that government of the people, by the people, for the people, shall not perish from the earth.",
  },
];

const MAX_SENTENCE_CHARS = 130;

async function fetchWebText(ref) {
  const res = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=web`);
  if (!res.ok) throw new Error(`bible-api ${ref}: HTTP ${res.status} ${(await res.text()).slice(0, 150)}`);
  const body = await res.json();
  if (!body.verses?.length) throw new Error(`bible-api ${ref}: no verses in response`);
  return body.verses.map((v) => v.text.replace(/\s+/g, " ").trim()).join(" ");
}

// A sentence longer than the cap splits at the clause boundary nearest its
// middle — shadowing needs chunks a learner can hold in working memory.
function splitLong(sentence) {
  if (sentence.length <= MAX_SENTENCE_CHARS) return [sentence];
  const breaks = [...sentence.matchAll(/[,;—] +/g)].map((m) => m.index + m[0].length);
  if (breaks.length === 0) return [sentence];
  const mid = sentence.length / 2;
  const at = breaks.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
  return [...splitLong(sentence.slice(0, at).trim()), ...splitLong(sentence.slice(at).trim())];
}

function toSentences(text) {
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  return [...segmenter.segment(text.replace(/\s+/g, " ").trim())]
    .map((s) => s.segment.trim())
    .filter(Boolean)
    .flatMap(splitLong);
}

const passages = [];
for (const spec of SPEC) {
  const text = spec.text ?? (await fetchWebText(spec.ref));
  const sentences = toSentences(text);
  passages.push({
    id: spec.id,
    collection: spec.collection,
    title: spec.title,
    source: spec.source,
    sentences,
  });
  const words = text.split(/\s+/).length;
  console.log(`${spec.id}: ${sentences.length} sentences, ${words} words`);
}

writeFileSync(
  join(root, "src", "constants", "shadowingLibrary.json"),
  JSON.stringify({ builtAt: new Date().toISOString(), passages }, null, 2) + "\n",
);
console.log(`\n${passages.length} passages written to src/constants/shadowingLibrary.json`);
