import { createProgressStore } from "../progressStore";

export type { DrillSession, TrackStats } from "../progressStore";

// Separate key from listening — these are distinct rows-to-be in the future
// drill_sessions table (kind: "production" vs "hvpt").
export const { loadSessions, saveSession, trackStats } = createProgressStore(
  "getaccent.production.sessions",
);
