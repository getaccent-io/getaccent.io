// Write-through + sign-in sync between the localStorage progress stores and
// the Supabase drill_sessions table. localStorage stays the source of truth
// for the UI (synchronous, works signed-out); Supabase makes progress durable
// and cross-device. Without env keys or a signed-in user, everything here is
// a no-op and the app behaves exactly as before.

import { getSupabase } from "@/lib/supabase/client";
import type { DrillSession } from "./progressStore";
import { DRILL_STORES, type DrillKind } from "./stores";

interface DrillSessionRow {
  kind: string;
  track_id: string;
  date: string;
  correct: number;
  total: number;
}

function toRow(userId: string, kind: DrillKind, s: DrillSession) {
  return {
    user_id: userId,
    kind,
    track_id: s.trackId,
    date: s.date,
    correct: s.correct,
    total: s.total,
  };
}

function toSession(row: DrillSessionRow): DrillSession {
  return {
    trackId: row.track_id,
    // Postgres returns timestamptz as "+00:00"; local dates are toISOString()
    // "Z" strings. Normalize so dedupe keys compare equal.
    date: new Date(row.date).toISOString(),
    correct: row.correct,
    total: row.total,
  };
}

const UPSERT_OPTS = { onConflict: "user_id,kind,track_id,date", ignoreDuplicates: true };

/** Fire-and-forget write-through of one finished session. No-op signed out. */
export function pushSession(kind: DrillKind, session: DrillSession): void {
  const supabase = getSupabase();
  if (!supabase) return;
  void (async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    const { error } = await supabase
      .from("drill_sessions")
      .upsert(toRow(userId, kind, session), UPSERT_OPTS);
    if (error) console.warn("Drill session push failed:", error.message);
  })();
}

/**
 * Two-way sync, run on sign-in and app load: pull the user's remote sessions
 * into localStorage, then push local sessions the server doesn't have. The
 * push leg is also the one-time localStorage → Supabase migration — progress
 * made before signing up simply uploads on first sign-in.
 */
export async function syncDrillSessions(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return;

  const { data, error } = await supabase
    .from("drill_sessions")
    .select("kind, track_id, date, correct, total");
  if (error) {
    console.warn("Drill session sync failed:", error.message);
    return;
  }
  const rows = (data ?? []) as DrillSessionRow[];

  for (const kind of Object.keys(DRILL_STORES) as DrillKind[]) {
    const store = DRILL_STORES[kind];
    const remote = rows.filter((r) => r.kind === kind).map(toSession);
    store.mergeSessions(remote);

    const remoteKeys = new Set(remote.map((s) => `${s.trackId}|${s.date}`));
    const localOnly = store
      .loadSessions()
      .filter((s) => !remoteKeys.has(`${s.trackId}|${s.date}`));
    if (localOnly.length > 0) {
      const { error: pushError } = await supabase
        .from("drill_sessions")
        .upsert(localOnly.map((s) => toRow(userId, kind, s)), UPSERT_OPTS);
      if (pushError) console.warn("Drill session upload failed:", pushError.message);
    }
  }
}
