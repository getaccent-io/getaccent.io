// Target accent for the whole product: which English the user is aiming for.
// Drives the Azure assessment locale AND which drill audio bank plays. Chosen
// on the home screen, stored in localStorage, default American.
//
// Server-safe module (the API route imports it) — the React hook lives in
// src/hooks/useAccent.ts.

export type Accent = "us" | "uk";

export const ACCENTS: { id: Accent; label: string; flag: string }[] = [
  { id: "us", label: "American", flag: "🇺🇸" },
  { id: "uk", label: "British", flag: "🇬🇧" },
];

export const ACCENT_LOCALE: Record<Accent, "en-US" | "en-GB"> = {
  us: "en-US",
  uk: "en-GB",
};

const KEY = "getaccent.accent";
export const ACCENT_CHANGE_EVENT = "getaccent:accent";

export function isAccent(x: unknown): x is Accent {
  return x === "us" || x === "uk";
}

export function getAccent(): Accent {
  if (typeof window === "undefined") return "us";
  const v = window.localStorage.getItem(KEY);
  return isAccent(v) ? v : "us";
}

export function setAccent(accent: Accent): void {
  window.localStorage.setItem(KEY, accent);
  window.dispatchEvent(new Event(ACCENT_CHANGE_EVENT));
}
