import libraryJson from "@/constants/shadowingLibrary.json";

// Typed access to the baked shadowing library (public-domain texts only —
// see scripts/build-shadowing-library.mjs for sources and rebuild).

export type ShadowCollection = "bible" | "classics";

export interface ShadowPassage {
  id: string;
  collection: ShadowCollection;
  title: string;
  source: string;
  sentences: string[];
}

export const SHADOW_PASSAGES = libraryJson.passages as ShadowPassage[];

export interface ShadowCollectionInfo {
  id: ShadowCollection;
  label: string;
  emoji: string;
  description: string;
}

export const SHADOW_COLLECTIONS: ShadowCollectionInfo[] = [
  {
    id: "bible",
    label: "Bible",
    emoji: "📖",
    description:
      "World English Bible — public domain, modern English. Passages you already know free your attention for the sound.",
  },
  {
    id: "classics",
    label: "Classics",
    emoji: "🏛️",
    description: "Short public-domain classics with famous rhythm — a fable and a speech.",
  },
];

export function getShadowCollection(id: string): ShadowCollectionInfo | undefined {
  return SHADOW_COLLECTIONS.find((c) => c.id === id);
}

export function getShadowPassage(id: string): ShadowPassage | undefined {
  return SHADOW_PASSAGES.find((p) => p.id === id);
}

/** Rough session length: listen pass + per-sentence model + shadow gap. */
export function estimateMinutes(sentenceCount: number): number {
  return Math.max(2, Math.round((sentenceCount * 13.5) / 60));
}
