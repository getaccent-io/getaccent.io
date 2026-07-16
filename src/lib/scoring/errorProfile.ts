import type {
  AzureAssessmentResult,
  AzureWord,
  ErrorFinding,
  ErrorProfile,
  PhonemeIssue,
  SyllableStructureIssue,
  WordResult,
  WordStressIssue,
} from "@/types/assessment";
import { recommendDrills } from "./recommendDrills";

// Azure's default (SAPI) phoneme alphabet for en-US.
const VOWELS = new Set([
  "aa", "ae", "ah", "ao", "aw", "ax", "ay",
  "eh", "er", "ey", "ih", "iy",
  "ow", "oy", "uh", "uw",
]);

// Sounds Korean speakers characteristically struggle with. Used to annotate
// findings, not to bias detection — every phoneme is scored the same way.
const KOREAN_TYPICAL = new Set(["r", "l", "th", "dh", "f", "v", "z", "zh", "w", "b", "p"]);

const PHONEME_WEAK = 70; // below this a phoneme instance counts as weak
const SYLLABLE_WEAK = 60; // below this a syllable counts as weak (stress proxy)
const MIN_OCCURRENCES = 2; // one bad instance could be noise; require a pattern

const isConsonant = (p: string) => !VOWELS.has(p.toLowerCase());

function phonemeAccuracy(w: AzureWord): { phoneme: string; accuracy: number }[] {
  // Empty names occur on en-GB results for words outside the UK naming
  // template — those phonemes can't be classified, so skip them. Naming is
  // all-or-nothing per word, so this never truncates a word mid-sequence.
  return (w.Phonemes ?? [])
    .map((p) => ({
      phoneme: p.Phoneme.toLowerCase(),
      accuracy: p.PronunciationAssessment?.AccuracyScore ?? NaN,
    }))
    .filter((p) => p.phoneme !== "" && !Number.isNaN(p.accuracy));
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

const clampSeverity = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

// --- Error 1: phoneme production -------------------------------------------
// A sound the learner can't physically make shows up as consistently low
// accuracy on that phoneme across different words.
function findPhonemeProduction(words: AzureWord[]): ErrorFinding {
  const byPhoneme = new Map<string, { scores: number[]; words: Set<string> }>();

  for (const w of words) {
    if (w.PronunciationAssessment?.ErrorType === "Insertion") continue;
    for (const p of phonemeAccuracy(w)) {
      const entry = byPhoneme.get(p.phoneme) ?? { scores: [], words: new Set() };
      entry.scores.push(p.accuracy);
      if (p.accuracy < PHONEME_WEAK) entry.words.add(w.Word.toLowerCase());
      byPhoneme.set(p.phoneme, entry);
    }
  }

  const issues: PhonemeIssue[] = [];
  for (const [phoneme, { scores, words: exampleWords }] of byPhoneme) {
    const avg = mean(scores);
    if (scores.length >= MIN_OCCURRENCES && avg < PHONEME_WEAK) {
      issues.push({
        phoneme,
        avgAccuracy: Math.round(avg),
        occurrences: scores.length,
        exampleWords: [...exampleWords].slice(0, 4),
        koreanTypical: KOREAN_TYPICAL.has(phoneme),
      });
    }
  }
  issues.sort((a, b) => a.avgAccuracy - b.avgAccuracy);

  const detected = issues.length > 0;
  const severity = detected
    ? clampSeverity(100 - mean(issues.map((i) => i.avgAccuracy)))
    : 0;

  return {
    id: "phoneme-production",
    label: "Phoneme production",
    detected,
    severity,
    summary: detected
      ? `${issues.length} sound${issues.length > 1 ? "s" : ""} scored consistently low — likely articulation, not slips.`
      : "No sound was consistently mispronounced.",
    phonemes: issues,
  };
}

// --- Error 2: syllable structure --------------------------------------------
// Korean avoids clusters and word-final consonants by inserting vowels
// ("street" → "seuteureet"). Azure has no epenthesis detector, so we proxy it:
// weak scores concentrated on final consonants and on consonant clusters.
function findSyllableStructure(words: AzureWord[]): ErrorFinding {
  const issues: SyllableStructureIssue[] = [];

  for (const w of words) {
    if (w.PronunciationAssessment?.ErrorType === "Insertion") continue;
    const ps = phonemeAccuracy(w);
    if (ps.length === 0) continue;

    // If the final consonant closes a cluster, the cluster check owns it —
    // counting it here too would turn one weak phoneme into two issues.
    const last = ps[ps.length - 1];
    const beforeLast = ps.length >= 2 ? ps[ps.length - 2] : null;
    const finalClosesCluster = beforeLast !== null && isConsonant(beforeLast.phoneme);
    if (isConsonant(last.phoneme) && !finalClosesCluster && last.accuracy < PHONEME_WEAK) {
      issues.push({
        word: w.Word,
        kind: "final-consonant",
        detail: `final /${last.phoneme}/`,
        accuracy: Math.round(last.accuracy),
        phonemes: [last.phoneme],
      });
    }

    // Consonant clusters: runs of 2+ consonants with a weak member.
    let run: typeof ps = [];
    const flushRun = () => {
      if (run.length >= 2) {
        const weakest = run.reduce((a, b) => (a.accuracy < b.accuracy ? a : b));
        if (weakest.accuracy < PHONEME_WEAK) {
          issues.push({
            word: w.Word,
            kind: "cluster",
            detail: `cluster /${run.map((r) => r.phoneme).join(" ")}/`,
            accuracy: Math.round(weakest.accuracy),
            phonemes: run.filter((r) => r.accuracy < PHONEME_WEAK).map((r) => r.phoneme),
          });
        }
      }
      run = [];
    };
    for (const p of ps) {
      if (isConsonant(p.phoneme)) run.push(p);
      else flushRun();
    }
    flushRun();
  }

  issues.sort((a, b) => a.accuracy - b.accuracy);

  // A couple of weak spots is noise; a pattern across several words is not.
  const detected = issues.length >= 3;
  const severity = detected
    ? clampSeverity((100 - mean(issues.map((i) => i.accuracy))) * Math.min(1, issues.length / 6))
    : 0;

  return {
    id: "syllable-structure",
    label: "Syllable structure",
    detected,
    severity,
    summary: detected
      ? "Consonant clusters and word-final consonants scored low — the typical vowel-insertion pattern."
      : "Clusters and word endings look fine.",
    issues: issues.slice(0, 8),
  };
}

// --- Error 3: word stress ----------------------------------------------------
// No direct stress signal from Azure, so two proxies: a markedly weak syllable
// inside an otherwise-okay multisyllabic word, and prosody feedback (monotone).
function findWordStress(words: AzureWord[], prosodyScore: number | null): ErrorFinding {
  const issues: WordStressIssue[] = [];
  let monotone = false;

  for (const w of words) {
    const intonationErrors =
      w.PronunciationAssessment?.Feedback?.Prosody?.Intonation?.ErrorTypes ?? [];
    if (intonationErrors.includes("Monotone")) monotone = true;

    const syllables = w.Syllables ?? [];
    if (syllables.length < 2) continue;

    const weak = syllables
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => (s.PronunciationAssessment?.AccuracyScore ?? 100) < SYLLABLE_WEAK);
    const wordAccuracy = w.PronunciationAssessment?.AccuracyScore ?? 0;
    if (weak.length > 0 && weak.length < syllables.length) {
      issues.push({
        word: w.Word,
        // en-GB leaves syllable names empty — fall back to the position.
        weakSyllables: weak.map(({ s, i }) => s.Syllable || `syllable ${i + 1}`),
        accuracy: Math.round(wordAccuracy),
      });
    }
  }

  const detected = issues.length >= 2 || monotone;
  const heuristic = clampSeverity(issues.length * 18 + (monotone ? 30 : 0));
  const severity = detected
    ? prosodyScore !== null
      ? clampSeverity(0.5 * (100 - prosodyScore) + 0.5 * heuristic)
      : heuristic
    : 0;

  return {
    id: "word-stress",
    label: "Word stress",
    detected,
    severity,
    summary: detected
      ? monotone
        ? "Uneven syllables in longer words, and delivery reads as monotone."
        : "Some longer words have one syllable much weaker than the rest — a stress-placement signal."
      : "Stress placement in longer words looks fine.",
    words: issues.slice(0, 8),
    monotone,
  };
}

// --- Assemble ----------------------------------------------------------------

export function buildErrorProfile(result: AzureAssessmentResult): ErrorProfile {
  const pa = result.PronunciationAssessment;
  const prosody = pa.ProsodyScore ?? null;

  const words: WordResult[] = result.Words.map((w) => ({
    word: w.Word,
    accuracy: w.PronunciationAssessment?.AccuracyScore ?? null,
    errorType: w.PronunciationAssessment?.ErrorType ?? "None",
    phonemes: (w.Phonemes ?? []).map((p) => ({
      phoneme: p.Phoneme,
      accuracy: p.PronunciationAssessment?.AccuracyScore ?? null,
    })),
  }));

  const findings = [
    findPhonemeProduction(result.Words),
    findSyllableStructure(result.Words),
    findWordStress(result.Words, prosody),
  ];

  return {
    overall: {
      pronScore: Math.round(pa.PronScore),
      accuracy: Math.round(pa.AccuracyScore),
      fluency: Math.round(pa.FluencyScore),
      completeness: Math.round(pa.CompletenessScore),
      prosody: prosody !== null ? Math.round(prosody) : null,
    },
    findings,
    recommendations: recommendDrills(findings),
    words,
  };
}
