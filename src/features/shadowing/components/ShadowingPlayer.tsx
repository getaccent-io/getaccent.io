"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccent } from "@/hooks/useAccent";
import type { Accent } from "@/lib/accent";
import { useShadowScoring, type SentenceScore } from "../hooks/useShadowScoring";
import { estimateMinutes, type ShadowPassage } from "../library";
import { markCompleted, passageProgress, saveLastScore, saveResume } from "../progress";

// Gap = how long the learner gets to shadow a sentence: a bit longer than
// the model took to say it. Scored sessions get more headroom — people
// speak slower than the TTS and need reaction time before the mic cutoff.
const GAP_FACTOR = 1.35;
const GAP_PAD_S = 0.4;
const MIN_GAP_S = 2;
const SCORED_GAP_FACTOR = 1.6;
const SCORED_GAP_PAD_S = 0.6;
const SCORED_MIN_GAP_S = 3;
const SLOW_RATE = 0.85;
const TICK_MS = 100;

interface Manifest {
  voice: string;
  passages: Record<string, number>;
}

// intro → listen (full read-along, skippable) → shadow (per sentence:
// model plays, then a timed gap to shadow it) → done.
type Phase = "intro" | "listen" | "shadow" | "done";
type ShadowStep = "model" | "gap";

function clipUrl(accent: Accent, passageId: string, index: number): string {
  return `/audio/shadowing/${accent}/${passageId}/${index}.mp3`;
}

/** "en-US-JennyNeural" → "Jenny" */
function voiceLabel(voice: string): string {
  return voice.replace(/^en-(US|GB)-/, "").replace(/Neural$/, "");
}

function scoreColor(n: number): string {
  if (n >= 80) return "text-emerald-700";
  if (n >= 60) return "text-amber-600";
  return "text-red-600";
}

/** Summary of a scored session; null until every in-flight score settles. */
function summarize(results: Record<number, SentenceScore>, total: number) {
  const entries = Object.values(results);
  if (entries.some((e) => e.status === "pending")) return null;
  const scored = entries.filter((e) => e.status === "scored");
  if (scored.length === 0) return null;
  const prosodies = scored.map((e) => e.prosody).filter((p): p is number => p !== null);
  return {
    pron: Math.round(scored.reduce((a, e) => a + e.pron, 0) / scored.length),
    prosody: prosodies.length
      ? Math.round(prosodies.reduce((a, b) => a + b, 0) / prosodies.length)
      : null,
    attempted: scored.length,
    total,
  };
}

export function ShadowingPlayer({ passage }: { passage: ShadowPassage }) {
  const accent = useAccent();
  const {
    micReady,
    results,
    startSession,
    beginClip,
    endClip,
    discardClip,
    pauseClip,
    resumeClip,
    resetResults,
  } = useShadowScoring();
  const [manifest, setManifest] = useState<Manifest | null | "missing">(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<ShadowStep>("model");
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  const [scoringWanted, setScoringWanted] = useState(true);
  const [scoringOn, setScoringOn] = useState(false); // wanted AND mic live
  const [gapProgress, setGapProgress] = useState(1); // 1 → 0 as the gap drains
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gapLeftRef = useRef(0); // seconds — survives pause/resume
  const gapTotalRef = useRef(1);
  const slowRef = useRef(false);
  const completedRef = useRef(false);
  const scoreSavedRef = useRef(false);

  const total = passage.sentences.length;

  useEffect(() => {
    fetch(`/audio/shadowing/${accent}/manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((m: Manifest) => setManifest(m))
      .catch(() => setManifest("missing"));
  }, [accent]);

  // Resume offer — localStorage, read deferred past hydration like the
  // track lists do.
  useEffect(() => {
    const id = setTimeout(() => {
      const p = passageProgress(passage.id);
      if (p?.resumeIndex != null && p.resumeIndex > 0 && p.resumeIndex < total) {
        setResumeAt(p.resumeIndex);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [passage.id, total]);

  // Model playback — one audio element per (phase, index, step) run.
  useEffect(() => {
    if (typeof manifest !== "object" || manifest === null) return;
    const playing = phase === "listen" || (phase === "shadow" && step === "model");
    if (!playing) return;
    if (phase === "shadow") saveResume(passage.id, index);

    const audio = new Audio(clipUrl(accent, passage.id, index));
    audio.playbackRate = slowRef.current ? SLOW_RATE : 1;
    audioRef.current = audio;
    audio.onended = () => {
      if (phase === "listen") {
        if (index + 1 < total) setIndex(index + 1);
        else {
          setIndex(0);
          setPhase("shadow");
          setStep("model");
        }
      } else {
        const rate = audio.playbackRate || 1;
        const spoken = audio.duration / rate;
        const gap = scoringOn
          ? Math.max(SCORED_MIN_GAP_S, spoken * SCORED_GAP_FACTOR + SCORED_GAP_PAD_S)
          : Math.max(MIN_GAP_S, spoken * GAP_FACTOR + GAP_PAD_S);
        gapTotalRef.current = gap;
        gapLeftRef.current = gap;
        setGapProgress(1);
        if (scoringOn) beginClip();
        setStep("gap");
      }
    };
    audio.onerror = () => setAudioError(true);
    void audio.play().catch(() => {});
    return () => {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    };
  }, [phase, index, step, accent, manifest, passage.id, total, scoringOn, beginClip]);

  // Gap countdown. Remaining time lives in a ref so pausing just stops the
  // interval and a new one picks up where it left off; the tick scores the
  // recorded attempt and advances when the gap runs out.
  useEffect(() => {
    if (phase !== "shadow" || step !== "gap" || paused) return;
    const startedAt = Date.now();
    const startLeft = gapLeftRef.current;
    const t = setInterval(() => {
      const left = startLeft - (Date.now() - startedAt) / 1000;
      gapLeftRef.current = Math.max(0, left);
      if (left > 0) {
        setGapProgress(left / gapTotalRef.current);
        return;
      }
      if (scoringOn) endClip(index, passage.sentences[index], accent);
      if (index + 1 < total) {
        setIndex(index + 1);
        setStep("model");
      } else {
        setPhase("done");
      }
    }, TICK_MS);
    return () => clearInterval(t);
  }, [phase, step, paused, index, total, scoringOn, endClip, passage.sentences, accent]);

  useEffect(() => {
    if (phase === "done" && !completedRef.current) {
      completedRef.current = true;
      markCompleted(passage.id);
    }
  }, [phase, passage.id]);

  // Once every in-flight score has settled after a completed run, persist
  // the session summary for the library card.
  const summary = phase === "done" ? summarize(results, total) : null;
  useEffect(() => {
    if (phase === "done" && summary && !scoreSavedRef.current) {
      scoreSavedRef.current = true;
      saveLastScore(passage.id, summary);
    }
  }, [phase, summary, passage.id]);

  const begin = (startIndex: number, withListen: boolean) => {
    setAudioError(false);
    setPaused(false);
    setIndex(startIndex);
    setStep("model");
    setPhase(withListen ? "listen" : "shadow");
  };

  const start = async (startIndex: number, withListen: boolean) => {
    // Ask for the mic before the loop starts — one prompt for the session.
    // If it's declined the session still runs, just unscored.
    setScoringOn(scoringWanted ? await startSession() : false);
    begin(startIndex, withListen);
  };

  const togglePause = () => {
    const audio = audioRef.current;
    if (step === "model" || phase === "listen") {
      if (paused) void audio?.play().catch(() => {});
      else audio?.pause();
    } else if (scoringOn) {
      if (paused) resumeClip();
      else pauseClip();
    }
    setPaused((p) => !p);
  };

  const replay = useCallback(() => {
    setPaused(false);
    if (step === "gap") {
      // Redoing the sentence — the half-taken attempt shouldn't be scored.
      if (scoringOn) discardClip();
      setStep("model");
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play().catch(() => {});
    }
  }, [step, scoringOn, discardClip]);

  const goTo = (i: number) => {
    setPaused(false);
    if (step === "gap" && scoringOn) {
      // Skipping forward keeps the attempt; going back discards it.
      if (i > index) endClip(index, passage.sentences[index], accent);
      else discardClip();
    }
    if (i >= total) {
      setPhase("done");
      return;
    }
    setIndex(Math.max(0, i));
    setStep("model");
  };

  const toggleSlow = () => {
    const next = !slow;
    setSlow(next);
    slowRef.current = next;
    if (audioRef.current) audioRef.current.playbackRate = next ? SLOW_RATE : 1;
  };

  if (manifest === null) {
    return <p className="py-10 text-center text-sm text-neutral-500">Loading…</p>;
  }
  if (manifest === "missing") {
    return (
      <p className="py-10 text-center text-sm text-neutral-600">
        Shadowing audio hasn&apos;t been generated yet — run{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5">npm run gen:shadowing</code> and
        reload.
      </p>
    );
  }
  if (manifest.passages[passage.id] !== total) {
    return (
      <p className="py-10 text-center text-sm text-neutral-600">
        The audio bank doesn&apos;t match this passage (the library changed since it was
        generated) — rerun{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5">npm run gen:shadowing</code>.
      </p>
    );
  }
  if (audioError) {
    return (
      <p className="py-10 text-center text-sm text-red-600">
        A clip failed to load — check the audio bank and reload.
      </p>
    );
  }

  if (phase === "intro") {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{passage.title}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {passage.source} · {total} sentences · ~{estimateMinutes(total)} min · voice:{" "}
            {voiceLabel(manifest.voice)}
          </p>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-neutral-600">
          First you&apos;ll hear the whole passage while you read along. Then it plays one
          sentence at a time — repeat each one out loud in the gap, copying the rhythm and
          melody, not just the words.
        </p>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={scoringWanted}
            onChange={(e) => setScoringWanted(e.target.checked)}
            className="h-4 w-4 accent-neutral-900"
          />
          🎙️ Score my shadows — records only during your turn, each sentence gets a score
        </label>
        {micReady === false && (
          <p className="text-xs text-amber-700">
            Microphone unavailable — running listen-and-repeat without scores.
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => void start(0, true)}
            className="rounded-full bg-neutral-900 px-8 py-3 font-medium text-white transition hover:bg-neutral-700"
          >
            Start
          </button>
          {resumeAt !== null && (
            <button
              onClick={() => void start(resumeAt, false)}
              className="rounded-full border border-neutral-300 px-8 py-3 font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              Resume at sentence {resumeAt + 1}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "listen") {
    return (
      <div className="flex flex-col gap-4 py-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">🔊 Listen and read along</p>
          <button
            onClick={() => begin(0, false)}
            className="text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            Skip to shadowing →
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto rounded-xl bg-neutral-50 p-4 text-lg leading-relaxed">
          {passage.sentences.map((s, i) => (
            <span key={i} className={i === index ? "rounded bg-amber-100 text-neutral-900" : "text-neutral-500"}>
              {s}{" "}
            </span>
          ))}
        </div>
        <div className="flex justify-center">
          <button
            onClick={togglePause}
            className="rounded-full border border-neutral-300 px-6 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const anyResults = Object.keys(results).length > 0;
    const stillScoring = Object.values(results).some((r) => r.status === "pending");
    const demo = Object.values(results).some((r) => r.status === "scored" && r.mode === "mock");
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="text-5xl">🎉</span>
        <p className="text-neutral-700">
          <span className="font-semibold">{passage.title}</span> shadowed — {total} sentences.
          Same passage tomorrow beats a new one today: repetition is where the rhythm sticks.
        </p>

        {anyResults && (
          <div className="w-full max-w-lg rounded-xl bg-neutral-50 p-4 text-left">
            {stillScoring ? (
              <p className="text-center text-sm text-neutral-500">Scoring the last few…</p>
            ) : summary ? (
              <p className="text-center text-sm text-neutral-700">
                <span className={`text-2xl font-bold tabular-nums ${scoreColor(summary.pron)}`}>
                  {summary.pron}
                </span>{" "}
                avg pronunciation
                {summary.prosody !== null && (
                  <>
                    {" · "}
                    <span className={`font-semibold ${scoreColor(summary.prosody)}`}>
                      {summary.prosody}
                    </span>{" "}
                    rhythm &amp; melody
                  </>
                )}
                {" · "}
                {summary.attempted}/{summary.total} shadowed
              </p>
            ) : (
              <p className="text-center text-sm text-neutral-500">
                No sentences were heard clearly enough to score.
              </p>
            )}
            <ul className="mt-3 space-y-1">
              {passage.sentences.map((s, i) => {
                const r = results[i];
                return (
                  <li key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="w-10 shrink-0 text-right font-medium tabular-nums">
                      {r?.status === "scored" ? (
                        <span className={scoreColor(r.pron)}>{r.pron}</span>
                      ) : r?.status === "pending" ? (
                        <span className="animate-pulse text-neutral-400">…</span>
                      ) : r?.status === "failed" ? (
                        <span className="text-neutral-400" title="scoring failed">
                          !
                        </span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </span>
                    <span className="truncate text-neutral-600">{s}</span>
                  </li>
                );
              })}
            </ul>
            {demo && (
              <p className="mt-2 text-center text-xs text-blue-800">
                Demo mode — no Azure key, so these are simulated scores.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => {
              completedRef.current = false;
              scoreSavedRef.current = false;
              resetResults();
              setResumeAt(null);
              void start(0, true);
            }}
            className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Practice again
          </button>
          <Link
            href={`/shadowing/${passage.collection}`}
            className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            All passages
          </Link>
        </div>
      </div>
    );
  }

  // shadow
  const inGap = step === "gap";
  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <p className="text-sm text-neutral-500">
        Sentence {index + 1} / {total}
      </p>
      <p className="min-h-20 max-w-xl text-center text-2xl font-medium leading-relaxed text-neutral-900">
        {passage.sentences[index]}
      </p>

      <div className="flex h-10 w-full max-w-md items-center justify-center">
        {inGap ? (
          <div className="w-full">
            <p className="mb-1.5 flex items-center justify-center gap-2 text-center text-sm font-medium text-emerald-700">
              🗣️ Your turn — say it out loud
              {scoringOn && !paused && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  rec
                </span>
              )}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.max(0, gapProgress * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm font-medium text-neutral-600">
            {paused ? "⏸ Paused" : "🔊 Listen…"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
        >
          ⏮ Back
        </button>
        <button
          onClick={replay}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          ↺ Hear again
        </button>
        <button
          onClick={togglePause}
          className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button
          onClick={() => goTo(index + 1)}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Next ⏭
        </button>
      </div>
      <button
        onClick={toggleSlow}
        aria-pressed={slow}
        className={`text-xs font-medium underline underline-offset-2 ${slow ? "text-blue-700" : "text-neutral-400 hover:text-neutral-600"}`}
      >
        {slow ? "0.85× slower — on" : "slow it down (0.85×)"}
      </button>

      {scoringOn && (
        <div className="flex max-w-lg flex-wrap justify-center gap-1">
          {passage.sentences.map((s, i) => {
            const r = results[i];
            return (
              <span
                key={i}
                title={s}
                className={`w-7 rounded py-0.5 text-center text-[10px] font-medium tabular-nums ${
                  i === index ? "ring-1 ring-neutral-400" : ""
                } ${
                  r?.status === "scored"
                    ? `bg-neutral-100 ${scoreColor(r.pron)}`
                    : r?.status === "pending"
                      ? "animate-pulse bg-neutral-100 text-neutral-400"
                      : "text-neutral-300"
                }`}
              >
                {r?.status === "scored"
                  ? r.pron
                  : r?.status === "pending"
                    ? "…"
                    : r?.status === "failed"
                      ? "!"
                      : "·"}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
