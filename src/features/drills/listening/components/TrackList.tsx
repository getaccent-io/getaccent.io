"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HVPT_TRACKS } from "@/constants/minimalPairs";
import { loadLastAssessment } from "@/features/assessment/lastAssessment";
import { trackStats, type TrackStats } from "../progress";

export function TrackList() {
  // Progress lives in localStorage; read it after mount to avoid hydration
  // mismatches between server and client renders.
  const [stats, setStats] = useState<Record<string, TrackStats> | null>(null);
  const [recommended, setRecommended] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Deferred so hydration completes against the server-rendered "no stats"
    // state before localStorage-dependent content appears.
    const id = setTimeout(() => {
      setStats(Object.fromEntries(HVPT_TRACKS.map((t) => [t.id, trackStats(t.id)])));
      setRecommended(new Set(loadLastAssessment()?.recommendations.map((r) => r.trackId) ?? []));
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {HVPT_TRACKS.map((track) => {
        const s = stats?.[track.id];
        return (
          <Link
            key={track.id}
            href={`/drills/listening/${track.id}`}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">{track.label}</h3>
              <div className="flex items-center gap-2">
                {/* A graduated track outranks a (by now stale) recommendation. */}
                {recommended.has(track.id) && !s?.graduated && (
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    recommended
                  </span>
                )}
                {s?.graduated ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    graduated 🎓
                  </span>
                ) : s && s.sessions > 0 ? (
                  <span className="text-xs text-neutral-500">
                    {s.sessions} session{s.sessions > 1 ? "s" : ""} · last {s.lastScore}%
                  </span>
                ) : (
                  <span className="text-xs text-neutral-400">not started</span>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm text-neutral-600">{track.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
