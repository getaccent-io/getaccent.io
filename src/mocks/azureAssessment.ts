import type {
  AzureAssessmentResult,
  AzurePhoneme,
  AzureSyllable,
  AzureWord,
} from "@/types/assessment";

// Fabricates a plausible Azure Pronunciation Assessment response for any
// reference text, so the whole flow runs without an Azure key. Deterministic
// (seeded PRNG) so results are stable across runs. The grapheme→phoneme pass
// is deliberately crude — it only needs to look right to the scoring code
// and the UI, not to a linguist.

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIGRAPHS: Record<string, string> = {
  th: "th", sh: "sh", ch: "ch", ng: "ng", ph: "f", wh: "w",
  ee: "iy", oo: "uw", ea: "iy", ai: "ey", ay: "ey", ow: "aw", ou: "aw", oi: "oy", oy: "oy",
};

const LETTERS: Record<string, string> = {
  a: "ae", b: "b", c: "k", d: "d", e: "eh", f: "f", g: "g", h: "h",
  i: "ih", j: "jh", k: "k", l: "l", m: "m", n: "n", o: "aa", p: "p",
  q: "k", r: "r", s: "s", t: "t", u: "ah", v: "v", w: "w", x: "k",
  y: "y", z: "z",
};

const VOWELS = new Set(["aa", "ae", "ah", "ao", "aw", "ax", "ay", "eh", "er", "ey", "ih", "iy", "ow", "oy", "uh", "uw"]);

// The mock persona: a Korean learner with the classic difficulty profile.
const WEAK_PHONEMES: Record<string, number> = {
  r: 45, l: 55, th: 40, dh: 42, f: 62, v: 58, z: 60, zh: 55, w: 74,
};

function toPhonemes(word: string): string[] {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const pair = clean.slice(i, i + 2);
    if (DIGRAPHS[pair]) {
      out.push(DIGRAPHS[pair]);
      i += 2;
      continue;
    }
    // silent final e
    if (clean[i] === "e" && i === clean.length - 1 && out.length > 1) break;
    const p = LETTERS[clean[i]];
    if (p && out[out.length - 1] !== p) out.push(p);
    i += 1;
  }
  return out.length ? out : ["ah"];
}

function toSyllables(word: string, phonemes: AzurePhoneme[]): AzureSyllable[] {
  // One syllable per vowel phoneme; consonants attach to the syllable in progress.
  const groups: AzurePhoneme[][] = [];
  let current: AzurePhoneme[] = [];
  let vowelsSeen = 0;
  for (const p of phonemes) {
    if (VOWELS.has(p.Phoneme) && current.some((c) => VOWELS.has(c.Phoneme))) {
      groups.push(current);
      current = [];
    }
    if (VOWELS.has(p.Phoneme)) vowelsSeen += 1;
    current.push(p);
  }
  if (current.length) groups.push(current);
  if (vowelsSeen === 0) return [{ Syllable: word, PronunciationAssessment: { AccuracyScore: 85 } }];

  return groups.map((g) => ({
    Syllable: g.map((p) => p.Phoneme).join(""),
    PronunciationAssessment: {
      AccuracyScore: Math.round(
        Math.min(...g.map((p) => p.PronunciationAssessment?.AccuracyScore ?? 85)),
      ),
    },
  }));
}

export function mockAzureAssessment(referenceText: string): AzureAssessmentResult {
  const rand = mulberry32(20260715);
  const tokens = referenceText.split(/\s+/).filter(Boolean);

  const words: AzureWord[] = tokens.map((token) => {
    const bare = token.replace(/[^a-zA-Z']/g, "");
    const phonemes: AzurePhoneme[] = toPhonemes(bare).map((p) => {
      const weakTarget = WEAK_PHONEMES[p];
      const base = weakTarget ?? 88;
      const score = Math.max(15, Math.min(100, Math.round(base + (rand() - 0.5) * 20)));
      return { Phoneme: p, PronunciationAssessment: { AccuracyScore: score } };
    });

    // Sprinkle syllable-structure trouble: weak final consonants on some words.
    const last = phonemes[phonemes.length - 1];
    if (last && !VOWELS.has(last.Phoneme) && rand() < 0.3) {
      last.PronunciationAssessment = {
        AccuracyScore: Math.round(35 + rand() * 25),
      };
    }

    const scores = phonemes.map((p) => p.PronunciationAssessment?.AccuracyScore ?? 85);
    const accuracy = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    return {
      Word: bare,
      PronunciationAssessment: {
        AccuracyScore: accuracy,
        ErrorType: accuracy < 45 ? "Mispronunciation" : "None",
      },
      Syllables: toSyllables(bare, phonemes),
      Phonemes: phonemes,
    };
  });

  const wordScores = words.map((w) => w.PronunciationAssessment?.AccuracyScore ?? 0);
  const accuracy = Math.round(wordScores.reduce((a, b) => a + b, 0) / wordScores.length);
  const fluency = 82;
  const completeness = 100;
  const prosody = 71;

  return {
    RecognizedText: referenceText,
    PronunciationAssessment: {
      AccuracyScore: accuracy,
      FluencyScore: fluency,
      CompletenessScore: completeness,
      ProsodyScore: prosody,
      PronScore: Math.round(
        0.4 * accuracy + 0.2 * prosody + 0.2 * fluency + 0.2 * completeness,
      ),
    },
    Words: words,
  };
}
