import type { AzureAssessmentResult } from "@/types/assessment";
import template from "./ukPhonemeNames.json";

// Azure's en-GB pronunciation assessment scores every phoneme but returns
// empty Phoneme names (naming is an en-US-only feature). For words we know —
// the assessment passage + the drill bank — this re-attaches SAPI-ish names
// from a count-verified template (scripts/build-uk-phoneme-names.mjs), so the
// rest of the pipeline (error findings, drill links, target-phoneme scoring)
// stays accent-blind. Words outside the template keep empty names and are
// skipped by the phoneme-level analyses.
//
// Caveat: the names are the en-US SAPI sequence aligned to en-GB's phoneme
// slots (en-GB splits US "er" into vowel + r). Consonant identities are
// exact; vowel names are US approximations of the RP vowels — fine for
// vowel/consonant classification and drill mapping, approximate for display.

const WORDS = template.words as Record<string, string[]>;

export function nameUkPhonemes(result: AzureAssessmentResult): AzureAssessmentResult {
  return {
    ...result,
    Words: result.Words.map((w) => {
      // Insertions aren't reference words — there's nothing to name them from.
      if (w.PronunciationAssessment?.ErrorType === "Insertion") return w;
      const seq = WORDS[w.Word.toLowerCase()];
      if (!seq || !w.Phonemes || seq.length !== w.Phonemes.length) return w;
      return { ...w, Phonemes: w.Phonemes.map((p, i) => ({ ...p, Phoneme: seq[i] })) };
    }),
  };
}
