"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HVPT_TRACKS } from "@/constants/minimalPairs";
import { dayStreak, loadSessions, trackStats, type TrackStats } from "@/features/drills/listening";

// Duolingo-style path: a friendly mascot, one big call to action, and a
// vertical journey of chunky nodes. Palette is ours though — violet + amber
// on cream, not owl green.

interface HomeStats {
  streak: number;
  totalSessions: number;
  graduated: number;
  tracks: Record<string, TrackStats>;
}

const NODE_OFFSETS = ["", "translate-x-8", "translate-x-16", "translate-x-8", "", "translate-x-8"];

function bubbleCopy(stats: HomeStats | null): string {
  if (!stats || stats.totalSessions === 0)
    return "안녕! Let's find out exactly what's holding your English back.";
  if (stats.streak >= 2) return `${stats.streak} days in a row — your ears are literally rewiring. Keep going!`;
  if (stats.graduated > 0) return "A contrast graduated! Ready to conquer the next one?";
  return "Welcome back! A quick session a day is all it takes.";
}

export function HomeScreen() {
  const [stats, setStats] = useState<HomeStats | null>(null);

  useEffect(() => {
    // Deferred so hydration completes before localStorage-dependent UI renders.
    const id = setTimeout(() => {
      const tracks = Object.fromEntries(HVPT_TRACKS.map((t) => [t.id, trackStats(t.id)]));
      setStats({
        streak: dayStreak(),
        totalSessions: loadSessions().length,
        graduated: Object.values(tracks).filter((s) => s.graduated).length,
        tracks,
      });
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <main className="min-h-screen bg-amber-50 px-4 pb-16">
      <div className="mx-auto max-w-md">
        {/* top bar */}
        <header className="flex items-center justify-between py-5">
          <span className="text-2xl font-extrabold tracking-tight text-violet-600">getaccent</span>
          <span
            className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold ${
              stats && stats.streak > 0
                ? "border-orange-200 bg-orange-100 text-orange-600"
                : "border-neutral-200 bg-white text-neutral-400"
            }`}
            title="Daily streak"
          >
            🔥 {stats?.streak ?? 0}
          </span>
        </header>

        {/* mascot + speech bubble */}
        <section className="mt-2 flex items-start gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-b-4 border-violet-300 bg-violet-100 text-5xl">
            🐯
          </div>
          <div className="relative mt-2 rounded-2xl rounded-bl-sm border-2 border-violet-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 shadow-sm">
            {bubbleCopy(stats)}
          </div>
        </section>

        {/* primary CTA */}
        <Link
          href="/assess"
          className="mt-6 block rounded-2xl border-b-4 border-violet-800 bg-violet-600 px-8 py-4 text-center text-lg font-extrabold text-white transition hover:bg-violet-500 active:translate-y-0.5 active:border-b-2"
        >
          🎤 Check my pronunciation
        </Link>
        <p className="mt-2 text-center text-xs font-medium text-neutral-400">
          ~1 minute · finds the sounds you need to train
        </p>

        {/* stats tiles */}
        <section className="mt-8 grid grid-cols-3 gap-3">
          {[
            { icon: "🔥", value: stats?.streak ?? 0, label: "day streak" },
            { icon: "🎧", value: stats?.totalSessions ?? 0, label: "sessions" },
            { icon: "🎓", value: stats?.graduated ?? 0, label: "graduated" },
          ].map((tile) => (
            <div
              key={tile.label}
              className="rounded-2xl border-2 border-amber-200 bg-white px-3 py-3 text-center"
            >
              <div className="text-xl">{tile.icon}</div>
              <div className="text-xl font-extrabold text-neutral-800">{tile.value}</div>
              <div className="text-[11px] font-medium text-neutral-400">{tile.label}</div>
            </div>
          ))}
        </section>

        {/* training path */}
        <section className="mt-10">
          <h2 className="mb-6 text-center text-sm font-bold tracking-wide text-neutral-400 uppercase">
            Your training path
          </h2>
          <div className="flex flex-col items-center gap-7">
            <PathNode
              href="/assess"
              offset={NODE_OFFSETS[0]}
              face="⭐"
              label="Pronunciation check"
              sub="start here"
              state="active"
            />
            {HVPT_TRACKS.map((track, i) => {
              const s = stats?.tracks[track.id];
              const state = s?.graduated ? "graduated" : s && s.sessions > 0 ? "active" : "fresh";
              return (
                <PathNode
                  key={track.id}
                  href={`/drills/listening/${track.id}`}
                  offset={NODE_OFFSETS[(i + 1) % NODE_OFFSETS.length]}
                  face={track.label.replace(" vs ", "·")}
                  label={track.label}
                  sub={
                    s?.graduated
                      ? "graduated 🎓"
                      : s && s.sessions > 0
                        ? `last score ${s.lastScore}%`
                        : "ear training"
                  }
                  state={state}
                />
              );
            })}
            <PathNode
              offset={NODE_OFFSETS[5 % NODE_OFFSETS.length]}
              face="🔒"
              label="Speaking drills"
              sub="coming soon"
              state="locked"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function PathNode({
  href,
  offset,
  face,
  label,
  sub,
  state,
}: {
  href?: string;
  offset: string;
  face: string;
  label: string;
  sub: string;
  state: "fresh" | "active" | "graduated" | "locked";
}) {
  const circle =
    state === "graduated"
      ? "border-b-4 border-amber-500 bg-amber-400 text-white"
      : state === "active"
        ? "border-b-4 border-violet-800 bg-violet-600 text-white"
        : state === "fresh"
          ? "border-2 border-b-4 border-violet-300 bg-white text-violet-600"
          : "border-b-4 border-neutral-300 bg-neutral-200 text-neutral-400";

  const content = (
    <div className={`flex items-center gap-4 ${offset}`}>
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full text-lg font-extrabold transition ${circle} ${
          href ? "hover:scale-105 active:translate-y-0.5 active:border-b-2" : ""
        }`}
      >
        {face}
      </div>
      <div>
        <div className={`font-bold ${state === "locked" ? "text-neutral-400" : "text-neutral-800"}`}>
          {label}
        </div>
        <div className="text-xs font-medium text-neutral-400">{sub}</div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
