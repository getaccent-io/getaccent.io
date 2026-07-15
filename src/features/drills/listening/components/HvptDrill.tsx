"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MinimalPairTrack } from "@/constants/minimalPairs";
import { saveSession } from "../progress";

const TRIALS_PER_SESSION = 10;

interface Trial {
  pair: [string, string];
  /** index into pair of the word actually played */
  target: 0 | 1;
  voice: string;
}

interface Manifest {
  voices: string[];
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildTrials(track: MinimalPairTrack, voices: string[]): Trial[] {
  // Cover every pair at least once before repeating any.
  const pairs: [string, string][] = [];
  while (pairs.length < TRIALS_PER_SESSION) pairs.push(...shuffle(track.pairs));
  return pairs.slice(0, TRIALS_PER_SESSION).map((pair) => ({
    pair,
    target: Math.random() < 0.5 ? 0 : 1,
    voice: voices[Math.floor(Math.random() * voices.length)],
  }));
}

function audioUrl(trackId: string, word: string, voice: string): string {
  return `/audio/drills/hvpt/${trackId}/${word}__${voice}.m4a`;
}

export function HvptDrill({ track }: { track: MinimalPairTrack }) {
  const [manifest, setManifest] = useState<Manifest | null | "missing">(null);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<0 | 1 | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    fetch("/audio/drills/hvpt/manifest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((m: Manifest) => {
        setManifest(m);
        setTrials(buildTrials(track, m.voices));
      })
      .catch(() => setManifest("missing"));
  }, [track]);

  const trial = trials[index];

  const play = useCallback(() => {
    if (!trial) return;
    audioRef.current?.pause();
    const audio = new Audio(audioUrl(track.id, trial.pair[trial.target], trial.voice));
    audioRef.current = audio;
    void audio.play();
  }, [trial, track.id]);

  // Auto-play each new trial.
  useEffect(() => {
    if (trial && answer === null) {
      const t = setTimeout(play, 300);
      return () => clearTimeout(t);
    }
  }, [trial, answer, play]);

  useEffect(() => {
    if (finished && !savedRef.current) {
      savedRef.current = true;
      saveSession({
        trackId: track.id,
        date: new Date().toISOString(),
        correct: correctCount,
        total: trials.length,
      });
    }
  }, [finished, correctCount, trials.length, track.id]);

  if (manifest === null) {
    return <p className="py-10 text-center text-sm text-neutral-500">Loading…</p>;
  }
  if (manifest === "missing") {
    return (
      <p className="py-10 text-center text-sm text-neutral-600">
        Drill audio hasn&apos;t been generated yet — run{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5">npm run gen:hvpt</code> and reload.
      </p>
    );
  }

  if (finished) {
    const pct = Math.round((correctCount / trials.length) * 100);
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <span className={`text-6xl font-bold ${pct >= 90 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600"}`}>
          {pct}%
        </span>
        <p className="text-neutral-600">
          {correctCount} of {trials.length} correct
          {pct >= 90
            ? " — excellent. Two sessions like this in a row and you graduate this contrast."
            : ". Keep at it — your ear improves fast with daily sessions."}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              savedRef.current = false;
              setTrials(buildTrials(track, manifest.voices));
              setIndex(0);
              setAnswer(null);
              setCorrectCount(0);
              setFinished(false);
            }}
            className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Another round
          </button>
          <Link
            href="/drills/listening"
            className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            All tracks
          </Link>
        </div>
      </div>
    );
  }

  if (!trial) return null;

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <p className="text-sm text-neutral-500">
        {index + 1} / {trials.length}
      </p>
      <button
        onClick={play}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-900 text-3xl text-white transition hover:bg-neutral-700"
        aria-label="Play word"
      >
        ▶
      </button>
      <p className="text-sm text-neutral-600">Which word did you hear?</p>
      <div className="flex gap-4">
        {trial.pair.map((word, i) => {
          const isAnswer = answer !== null && i === answer;
          const isTarget = answer !== null && i === trial.target;
          return (
            <button
              key={word}
              disabled={answer !== null}
              onClick={() => {
                setAnswer(i as 0 | 1);
                if (i === trial.target) setCorrectCount((c) => c + 1);
              }}
              className={`min-w-32 rounded-2xl border-2 px-8 py-4 text-xl font-medium transition ${
                isTarget
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                  : isAnswer
                    ? "border-red-400 bg-red-50 text-red-900"
                    : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 disabled:opacity-60"
              }`}
            >
              {word}
            </button>
          );
        })}
      </div>
      <div className="h-10">
        {answer !== null && (
          <button
            onClick={() => {
              if (index + 1 >= trials.length) setFinished(true);
              else {
                setIndex((i) => i + 1);
                setAnswer(null);
              }
            }}
            className="rounded-full bg-neutral-900 px-8 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            {index + 1 >= trials.length ? "See score" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}
