import type { Accent } from "@/lib/accent";
import type { DrillRecommendation } from "@/types/assessment";

// The latest real assessment's drill plan, kept in localStorage so the drill
// pages can badge "recommended" tracks after the results screen is gone.
// Mock results are never saved — demo data shouldn't steer real training.

const KEY = "getaccent.lastAssessment";

export interface LastAssessment {
  assessedAt: string;
  accent: Accent;
  recommendations: DrillRecommendation[];
}

export function saveLastAssessment(accent: Accent, recommendations: DrillRecommendation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ assessedAt: new Date().toISOString(), accent, recommendations }),
    );
  } catch {
    // storage full/blocked — recommendations just won't persist
  }
}

export function loadLastAssessment(): LastAssessment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastAssessment;
    if (!Array.isArray(parsed.recommendations)) return null;
    return parsed;
  } catch {
    return null;
  }
}
