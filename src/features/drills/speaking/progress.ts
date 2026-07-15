import type { DrillSession } from "../progressStore";
import { DRILL_STORES } from "../stores";
import { pushSession } from "../sync";

export type { DrillSession, TrackStats } from "../progressStore";

const store = DRILL_STORES.production;

export const loadSessions = store.loadSessions;
export const trackStats = store.trackStats;

/** Saves locally and, when Supabase is configured + signed in, writes through. */
export function saveSession(session: DrillSession): void {
  store.saveSession(session);
  pushSession("production", session);
}
