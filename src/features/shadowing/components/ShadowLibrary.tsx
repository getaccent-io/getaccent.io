"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { estimateMinutes, SHADOW_PASSAGES, type ShadowCollection } from "../library";
import { allProgress, type PassageProgress } from "../progress";

/** Contents of one book: its passages with per-passage progress. */
export function ShadowLibrary({ collection }: { collection: ShadowCollection }) {
  // Progress lives in localStorage; read it after mount to avoid hydration
  // mismatches between server and client renders.
  const [progress, setProgress] = useState<Record<string, PassageProgress> | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setProgress(allProgress()), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {SHADOW_PASSAGES.filter((p) => p.collection === collection).map((passage) => {
        const p = progress?.[passage.id];
        return (
          <Link
            key={passage.id}
            href={`/shadowing/${collection}/${passage.id}`}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">{passage.title}</h3>
              {p && p.completions > 0 && p.resumeIndex === null ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  done ×{p.completions}
                </span>
              ) : p && p.resumeIndex !== null && p.resumeIndex > 0 ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  resume at {p.resumeIndex + 1}/{passage.sentences.length}
                </span>
              ) : (
                <span className="text-xs text-neutral-400">not started</span>
              )}
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              {passage.source} · {passage.sentences.length} sentences · ~
              {estimateMinutes(passage.sentences.length)} min
            </p>
          </Link>
        );
      })}
    </div>
  );
}
