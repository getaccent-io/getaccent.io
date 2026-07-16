"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccent } from "@/hooks/useAccent";
import type { Accent } from "@/lib/accent";
import { estimateMinutes, type ShadowPassage } from "../library";
import { markCompleted, passageProgress, saveResume } from "../progress";

// Gap = how long the learner gets to shadow a sentence: a bit longer than
// the model took to say it, never under 2s.
const GAP_FACTOR = 1.35;
const GAP_PAD_S = 0.4;
const MIN_GAP_S = 2;
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

export function ShadowingPlayer({ passage }: { passage: ShadowPassage }) {
  const accent = useAccent();
  const [manifest, setManifest] = useState<Manifest | null | "missing">(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<ShadowStep>("model");
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  const [gapProgress, setGapProgress] = useState(1); // 1 → 0 as the gap drains
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gapLeftRef = useRef(0); // seconds — survives pause/resume
  const gapTotalRef = useRef(1);
  const slowRef = useRef(false);
  const completedRef = useRef(false);

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
        const gap = Math.max(MIN_GAP_S, (audio.duration / rate) * GAP_FACTOR + GAP_PAD_S);
        gapTotalRef.current = gap;
        gapLeftRef.current = gap;
        setGapProgress(1);
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
  }, [phase, index, step, accent, manifest, passage.id, total]);

  // Gap countdown. Remaining time lives in a ref so pausing just stops the
  // interval and a new one picks up where it left off; the tick advances to
  // the next sentence when the gap runs out.
  useEffect(() => {
    if (phase !== "shadow" || step !== "gap" || paused) return;
    const startedAt = Date.now();
    const startLeft = gapLeftRef.current;
    const t = setInterval(() => {
      const left = startLeft - (Date.now() - startedAt) / 1000;
      gapLeftRef.current = Math.max(0, left);
      if (left > 0) {
        setGapProgress(left / gapTotalRef.current);
      } else if (index + 1 < total) {
        setIndex(index + 1);
        setStep("model");
      } else {
        setPhase("done");
      }
    }, TICK_MS);
    return () => clearInterval(t);
  }, [phase, step, paused, index, total]);

  useEffect(() => {
    if (phase === "done" && !completedRef.current) {
      completedRef.current = true;
      markCompleted(passage.id);
    }
  }, [phase, passage.id]);

  const begin = (startIndex: number, withListen: boolean) => {
    setAudioError(false);
    setPaused(false);
    setIndex(startIndex);
    setStep("model");
    setPhase(withListen ? "listen" : "shadow");
  };

  const togglePause = () => {
    const audio = audioRef.current;
    if (step === "model" || phase === "listen") {
      if (paused) void audio?.play().catch(() => {});
      else audio?.pause();
    }
    setPaused((p) => !p);
  };

  const replay = useCallback(() => {
    setPaused(false);
    if (step === "gap") {
      setStep("model");
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play().catch(() => {});
    }
  }, [step]);

  const goTo = (i: number) => {
    setPaused(false);
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
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => begin(0, true)}
            className="rounded-full bg-neutral-900 px-8 py-3 font-medium text-white transition hover:bg-neutral-700"
          >
            Start
          </button>
          {resumeAt !== null && (
            <button
              onClick={() => begin(resumeAt, false)}
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
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="text-5xl">🎉</span>
        <p className="text-neutral-700">
          <span className="font-semibold">{passage.title}</span> shadowed — {total} sentences.
          Same passage tomorrow beats a new one today: repetition is where the rhythm sticks.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              completedRef.current = false;
              setResumeAt(null);
              begin(0, true);
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
            <p className="mb-1.5 text-center text-sm font-medium text-emerald-700">
              🗣️ Your turn — say it out loud
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
    </div>
  );
}
