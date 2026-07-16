import { getTrack, PHONEME_TO_TRACK } from "@/constants/minimalPairs";
import type { DrillRecommendation, ErrorFinding } from "@/types/assessment";

// FIND → FIX: turns the findings into a ranked drill plan. Weak phonemes
// (error 1) and the weak sounds inside clusters/endings (error 2) map onto
// minimal-pair tracks via PHONEME_TO_TRACK; tracks are ordered weakest sound
// first. Word stress (error 3) has no drill yet, so it never recommends.

interface TrackEvidence {
  scoreSum: number; // accuracy × weight, for the weighted average
  weight: number;
  phonemes: Set<string>;
  words: Set<string>;
  phonemeReasons: string[];
  structurePhonemes: Set<string>;
  structureHits: number;
}

export function recommendDrills(findings: ErrorFinding[]): DrillRecommendation[] {
  const byTrack = new Map<string, TrackEvidence>();
  const evidenceFor = (trackId: string): TrackEvidence => {
    const found = byTrack.get(trackId);
    if (found) return found;
    const fresh: TrackEvidence = {
      scoreSum: 0,
      weight: 0,
      phonemes: new Set(),
      words: new Set(),
      phonemeReasons: [],
      structurePhonemes: new Set(),
      structureHits: 0,
    };
    byTrack.set(trackId, fresh);
    return fresh;
  };

  for (const f of findings) {
    if (!f.detected) continue;

    if (f.id === "phoneme-production") {
      for (const p of f.phonemes) {
        const trackId = PHONEME_TO_TRACK[p.phoneme];
        if (!trackId) continue;
        const e = evidenceFor(trackId);
        // Weight by occurrences: a sound weak across 5 words outranks a
        // sound weak across 2 at the same average.
        e.scoreSum += p.avgAccuracy * p.occurrences;
        e.weight += p.occurrences;
        e.phonemes.add(p.phoneme);
        p.exampleWords.forEach((w) => e.words.add(w));
        e.phonemeReasons.push(`/${p.phoneme}/ averaged ${p.avgAccuracy}`);
      }
    }

    if (f.id === "syllable-structure") {
      for (const issue of f.issues) {
        for (const phoneme of issue.phonemes) {
          const trackId = PHONEME_TO_TRACK[phoneme];
          if (!trackId) continue;
          const e = evidenceFor(trackId);
          e.scoreSum += issue.accuracy;
          e.weight += 1;
          e.phonemes.add(phoneme);
          e.words.add(issue.word);
          e.structurePhonemes.add(phoneme);
          e.structureHits++;
        }
      }
    }
  }

  const recommendations: DrillRecommendation[] = [];
  for (const [trackId, e] of byTrack) {
    const track = getTrack(trackId);
    if (!track || e.weight === 0) continue;
    const reasonParts = [...e.phonemeReasons];
    if (e.structureHits > 0) {
      const sounds = [...e.structurePhonemes].map((p) => `/${p}/`).join(", ");
      reasonParts.push(
        `${sounds} weak in ${e.structureHits} cluster/ending spot${e.structureHits > 1 ? "s" : ""}`,
      );
    }
    recommendations.push({
      trackId,
      trackLabel: track.label,
      phonemes: [...e.phonemes],
      avgAccuracy: Math.round(e.scoreSum / e.weight),
      exampleWords: [...e.words].slice(0, 4),
      reason: reasonParts.join(" · "),
    });
  }

  return recommendations.sort((a, b) => a.avgAccuracy - b.avgAccuracy);
}
