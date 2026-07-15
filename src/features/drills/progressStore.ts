// Drill progress in localStorage — placeholder until real persistence
// (Supabase) lands. Shape is deliberately close to a future drill_sessions
// table so migration is a copy, not a rewrite. Each drill type gets its own
// storage key via createProgressStore.

export interface DrillSession {
  trackId: string;
  date: string; // ISO
  correct: number;
  total: number;
}

export interface TrackStats {
  sessions: number;
  lastScore: number | null; // 0–100
  graduated: boolean;
}

const GRADUATION_SCORE = 90; // percent, over the last…
const GRADUATION_STREAK = 2; // …consecutive sessions

export interface ProgressStore {
  loadSessions: () => DrillSession[];
  saveSession: (session: DrillSession) => void;
  mergeSessions: (incoming: DrillSession[]) => void;
  trackStats: (trackId: string) => TrackStats;
}

export function createProgressStore(storageKey: string): ProgressStore {
  const loadSessions = (): DrillSession[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as DrillSession[]) : [];
    } catch {
      return [];
    }
  };

  const saveSession = (session: DrillSession): void => {
    const all = loadSessions();
    all.push(session);
    window.localStorage.setItem(storageKey, JSON.stringify(all));
  };

  // Union incoming (remote) sessions into localStorage, deduped by
  // (trackId, date). Re-sorted chronologically because graduation looks at
  // the last N *consecutive* sessions — remote rows may interleave local ones.
  const mergeSessions = (incoming: DrillSession[]): void => {
    const all = loadSessions();
    const seen = new Set(all.map((s) => `${s.trackId}|${s.date}`));
    const added = incoming.filter((s) => !seen.has(`${s.trackId}|${s.date}`));
    if (added.length === 0) return;
    const merged = [...all, ...added].sort((a, b) => a.date.localeCompare(b.date));
    window.localStorage.setItem(storageKey, JSON.stringify(merged));
  };

  const trackStats = (trackId: string): TrackStats => {
    const sessions = loadSessions().filter((s) => s.trackId === trackId);
    const last = sessions[sessions.length - 1];
    const recent = sessions.slice(-GRADUATION_STREAK);
    const graduated =
      recent.length === GRADUATION_STREAK &&
      recent.every((s) => (s.correct / s.total) * 100 >= GRADUATION_SCORE);
    return {
      sessions: sessions.length,
      lastScore: last ? Math.round((last.correct / last.total) * 100) : null,
      graduated,
    };
  };

  return { loadSessions, saveSession, mergeSessions, trackStats };
}
