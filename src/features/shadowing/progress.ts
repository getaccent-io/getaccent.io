// Shadowing progress — resume position + completion count per passage, in
// localStorage like drill progress. Shaped so a future Supabase table can
// sync it the same way drill_sessions does.

const KEY = "getaccent.shadowing.v1";

export interface PassageProgress {
  /** Sentence index to resume from; null once the passage is completed. */
  resumeIndex: number | null;
  completions: number;
  lastAt: string;
}

type State = Record<string, PassageProgress>;

function load(): State {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as State;
  } catch {
    return {};
  }
}

function save(state: State): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full/blocked — progress just won't persist
  }
}

export function passageProgress(id: string): PassageProgress | null {
  return load()[id] ?? null;
}

export function allProgress(): State {
  return load();
}

export function saveResume(id: string, sentenceIndex: number): void {
  const state = load();
  const prev = state[id];
  state[id] = {
    resumeIndex: sentenceIndex,
    completions: prev?.completions ?? 0,
    lastAt: new Date().toISOString(),
  };
  save(state);
}

export function markCompleted(id: string): void {
  const state = load();
  const prev = state[id];
  state[id] = {
    resumeIndex: null,
    completions: (prev?.completions ?? 0) + 1,
    lastAt: new Date().toISOString(),
  };
  save(state);
}
