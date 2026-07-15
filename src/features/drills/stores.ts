import { createProgressStore } from "./progressStore";

// The two drill-progress stores, keyed by the `kind` value used in the
// Supabase drill_sessions table. Defined once so the localStorage keys and
// the sync layer can't drift apart.
export const DRILL_STORES = {
  hvpt: createProgressStore("getaccent.hvpt.sessions"),
  production: createProgressStore("getaccent.production.sessions"),
} as const;

export type DrillKind = keyof typeof DRILL_STORES;
