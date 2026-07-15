// Drill progress in localStorage — placeholder until real persistence
// (Supabase) lands. Shape is deliberately close to a future drill_sessions
// table so migration is a copy, not a rewrite.

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

const KEY = "getaccent.hvpt.sessions";
const GRADUATION_SCORE = 90; // percent, over the last…
const GRADUATION_STREAK = 2; // …consecutive sessions

export function loadSessions(): DrillSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DrillSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: DrillSession): void {
  const all = loadSessions();
  all.push(session);
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export function trackStats(trackId: string): TrackStats {
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
}
