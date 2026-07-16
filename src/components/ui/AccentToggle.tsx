"use client";

import { useAccent } from "@/hooks/useAccent";
import { ACCENTS, setAccent } from "@/lib/accent";

/**
 * US/UK target-accent switch shown on the start screen. The choice drives
 * both the assessment locale and which drill audio bank plays.
 */
export function AccentToggle() {
  const accent = useAccent();
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        role="group"
        aria-label="Target accent"
        className="flex rounded-full border border-neutral-200 bg-white p-1 shadow-sm"
      >
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAccent(a.id)}
            aria-pressed={accent === a.id}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              accent === a.id
                ? "bg-neutral-900 text-white"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {a.flag} {a.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-neutral-400">assessment &amp; drills target this accent</p>
    </div>
  );
}
