import libraryJson from "@/constants/shadowingLibrary.json";

// Typed access to the baked shadowing library (public-domain texts only —
// see scripts/build-shadowing-library.mjs for sources and rebuild).
//
// Hierarchy: collection → work → passage. A `work` groups passages under a
// source (a Bible book, a story, a speech). A work with a single passage
// collapses straight to the player in the UI. Facets (`license`, `difficulty`)
// live on the passage, not the tree — they filter/annotate, they don't nest.

export type ShadowCollection = "bible" | "classics";
export type ShadowDifficulty = "beginner" | "intermediate" | "advanced";

export interface ShadowPassage {
  id: string;
  workId: string;
  collection: ShadowCollection;
  title: string;
  source: string;
  sentences: string[];
  /** Attribution notice that must be shown wherever this text/audio appears. */
  license?: string;
  difficulty?: ShadowDifficulty;
}

/** A source that owns one or more passages (a book, a story, a speech). */
export interface ShadowWork {
  id: string;
  collection: ShadowCollection;
  title: string;
  source: string;
  passageIds: string[];
}

export const SHADOW_PASSAGES = libraryJson.passages as ShadowPassage[];
export const SHADOW_WORKS = libraryJson.works as ShadowWork[];

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

export function getShadowWork(id: string): ShadowWork | undefined {
  return SHADOW_WORKS.find((w) => w.id === id);
}

export function worksInCollection(collection: string): ShadowWork[] {
  return SHADOW_WORKS.filter((w) => w.collection === collection);
}

export function getShadowPassage(id: string): ShadowPassage | undefined {
  return SHADOW_PASSAGES.find((p) => p.id === id);
}

export function passagesInWork(workId: string): ShadowPassage[] {
  return SHADOW_PASSAGES.filter((p) => p.workId === workId);
}

/** A work with one passage collapses to the player, skipping its contents page. */
export function isSinglePassageWork(work: ShadowWork): boolean {
  return work.passageIds.length === 1;
}

/** Where the player's back link and a collapsed work card should point. */
export function passageHref(passage: ShadowPassage): string {
  return `/shadowing/${passage.collection}/${passage.workId}/${passage.id}`;
}

/** Rough session length: listen pass + per-sentence model + shadow gap. */
export function estimateMinutes(sentenceCount: number): number {
  return Math.max(2, Math.round((sentenceCount * 13.5) / 60));
}
