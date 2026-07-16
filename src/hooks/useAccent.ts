"use client";

import { useSyncExternalStore } from "react";
import { ACCENT_CHANGE_EVENT, getAccent, type Accent } from "@/lib/accent";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(ACCENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(ACCENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Reactive accent preference (SSR renders the default, then hydrates). */
export function useAccent(): Accent {
  return useSyncExternalStore(subscribe, getAccent, () => "us");
}
