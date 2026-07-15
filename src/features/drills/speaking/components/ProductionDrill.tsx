"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ARTICULATION } from "@/constants/articulation";
import type { MinimalPairTrack } from "@/constants/minimalPairs";
import { useRecorder } from "@/features/recording/hooks/useRecorder";
import { blobToWav16kMono } from "@/features/recording/utils/wav";
import type { AssessmentResponse } from "@/types/assessment";
import { saveSession } from "../progress";

const TRIALS_PER_SESSION = 10;
// Pass bar for the target sound — matches PHONEME_WEAK in the scoring brain,
// so "passed" means the assessment wouldn't flag this instance as weak.
const PASS_SCORE = 70;

interface Trial {
  word: string;
  /** SAPI symbol of the contrast member this word exercises. */
  phoneme: string;
  /** Model voice for this trial — varies across trials, fixed within one. */
  voice: string;
}

interface TrialResult {
  passed: boolean;
  /** null = Azure returned no score for the target sound (unclear audio). */
  phonemeAccuracy: number | null;
  wordAccuracy: number | null;
  phonemes: { phoneme: string; accuracy: number | null }[];
  mode: "azure" | "mock";
}

interface Manifest {
  voices: string[];
}

// While in "prompt", a finished recording (recorder.status === "recorded")
// means scoring is in flight — there is no stored "scoring" stage.
type Stage = "intro" | "prompt" | "feedback" | "finished";

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildTrials(track: MinimalPairTrack, voices: string[]): Trial[] {
  // Both words of a pair are drilled — each exercises one side of the contrast.
  const words = track.pairs.flatMap((pair) => [
    { word: pair[0], phoneme: track.phonemes[0] },
    { word: pair[1], phoneme: track.phonemes[1] },
  ]);
  const picked: { word: string; phoneme: string }[] = [];
  while (picked.length < TRIALS_PER_SESSION) picked.push(...shuffle(words));
  return picked.slice(0, TRIALS_PER_SESSION).map((w) => ({
    ...w,
    voice: voices[Math.floor(Math.random() * voices.length)],
  }));
}

function modelUrl(trackId: string, word: string, voice: string): string {
  return `/audio/drills/hvpt/${trackId}/${word}__${voice}.m4a`;
}

async function scoreAttempt(wav: Blob, word: string): Promise<AssessmentResponse> {
  const form = new FormData();
  form.append("audio", new File([wav], "attempt.wav", { type: "audio/wav" }));
  form.append("referenceText", word);
  form.append("source", "drill");
  const res = await fetch("/api/assessment", { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as AssessmentResponse;
}

function toTrialResult(res: AssessmentResponse, trial: Trial): TrialResult {
  const word =
    res.profile.words.find((w) => w.word.toLowerCase() === trial.word.toLowerCase()) ??
    res.profile.words[0];
  const targetScores = (word?.phonemes ?? [])
    .filter((p) => p.phoneme.toLowerCase() === trial.phoneme && p.accuracy !== null)
    .map((p) => p.accuracy as number);
  const phonemeAccuracy = targetScores.length
    ? Math.round(targetScores.reduce((a, b) => a + b, 0) / targetScores.length)
    : null;
  return {
    passed: phonemeAccuracy !== null && phonemeAccuracy >= PASS_SCORE,
    phonemeAccuracy,
    wordAccuracy: word?.accuracy ?? null,
    phonemes: word?.phonemes ?? [],
    mode: res.mode,
  };
}

function scoreColor(n: number | null): string {
  if (n === null) return "text-neutral-400";
  if (n >= PASS_SCORE) return "text-emerald-700";
  if (n >= 50) return "text-amber-600";
  return "text-red-600";
}

function ArticulationCard({ phoneme }: { phoneme: string }) {
  const guide = ARTICULATION[phoneme];
  if (!guide) return null;
  return (
    <div className="rounded-xl bg-neutral-50 p-4">
      <p className="font-medium text-neutral-900">
        <span className="font-mono font-semibold">/{guide.phoneme}/</span> as in “
        {guide.example}”
      </p>
      <p className="mt-1 text-sm leading-relaxed text-neutral-700">{guide.how}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-amber-800">{guide.pitfall}</p>
    </div>
  );
}

export function ProductionDrill({ track }: { track: MinimalPairTrack }) {
  const recorder = useRecorder();
  const [manifest, setManifest] = useState<Manifest | null | "missing">(null);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("intro");
  const [results, setResults] = useState<TrialResult[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const modelAudioRef = useRef<HTMLAudioElement | null>(null);
  const ownAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoplayedRef = useRef(-1);
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
  const result = results[results.length - 1];

  const playModel = useCallback(() => {
    if (!trial) return;
    ownAudioRef.current?.pause();
    modelAudioRef.current?.pause();
    const audio = new Audio(modelUrl(track.id, trial.word, trial.voice));
    modelAudioRef.current = audio;
    void audio.play();
  }, [trial, track.id]);

  const playOwn = useCallback(() => {
    if (!recorder.audioUrl) return;
    modelAudioRef.current?.pause();
    ownAudioRef.current?.pause();
    const audio = new Audio(recorder.audioUrl);
    ownAudioRef.current = audio;
    void audio.play();
  }, [recorder.audioUrl]);

  // Play the model once when each new prompt appears.
  useEffect(() => {
    if (stage === "prompt" && trial && autoplayedRef.current !== index) {
      autoplayedRef.current = index;
      const t = setTimeout(playModel, 300);
      return () => clearTimeout(t);
    }
  }, [stage, trial, index, playModel]);

  // Score as soon as a recording lands — once per trial (the ref also covers
  // StrictMode's double effect run).
  const submittedRef = useRef(-1);
  const resetRecorder = recorder.reset;
  useEffect(() => {
    if (stage !== "prompt" || recorder.status !== "recorded" || !recorder.blob || !trial) {
      return;
    }
    if (submittedRef.current === index) return;
    submittedRef.current = index;
    const blob = recorder.blob;
    void (async () => {
      try {
        const res = await scoreAttempt(await blobToWav16kMono(blob), trial.word);
        setResults((rs) => [...rs, toTrialResult(res, trial)]);
        setSubmitError(null);
        setStage("feedback");
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Scoring failed");
        submittedRef.current = -1;
        resetRecorder();
      }
    })();
  }, [stage, recorder.status, recorder.blob, trial, index, resetRecorder]);

  useEffect(() => {
    if (stage === "finished" && !savedRef.current) {
      savedRef.current = true;
      saveSession({
        trackId: track.id,
        date: new Date().toISOString(),
        correct: results.filter((r) => r.passed).length,
        total: trials.length,
      });
    }
  }, [stage, results, trials.length, track.id]);

  const next = () => {
    recorder.reset();
    if (index + 1 >= trials.length) setStage("finished");
    else {
      setIndex((i) => i + 1);
      setStage("prompt");
    }
  };

  const restart = () => {
    if (manifest === null || manifest === "missing") return;
    recorder.reset();
    savedRef.current = false;
    autoplayedRef.current = -1;
    submittedRef.current = -1;
    setTrials(buildTrials(track, manifest.voices));
    setIndex(0);
    setResults([]);
    setSubmitError(null);
    setStage("prompt");
  };

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

  if (stage === "intro") {
    return (
      <div className="flex flex-col gap-4 py-2">
        <h2 className="text-center font-semibold text-neutral-900">How to make the sounds</h2>
        <div className="flex flex-col gap-3">
          {track.phonemes.map((p) => (
            <ArticulationCard key={p} phoneme={p} />
          ))}
        </div>
        <p className="text-center text-sm text-neutral-600">
          Each round: hear a native model, record yourself saying the word, and get scored on
          the target sound instantly. {TRIALS_PER_SESSION} words per session.
        </p>
        <button
          onClick={() => setStage("prompt")}
          className="mx-auto rounded-full bg-neutral-900 px-8 py-3 font-medium text-white transition hover:bg-neutral-700"
        >
          Start
        </button>
      </div>
    );
  }

  if (stage === "finished") {
    const passed = results.filter((r) => r.passed).length;
    const pct = Math.round((passed / trials.length) * 100);
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <span
          className={`text-6xl font-bold ${pct >= 90 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600"}`}
        >
          {pct}%
        </span>
        <p className="text-center text-neutral-600">
          {passed} of {trials.length} sounds landed
          {pct >= 90
            ? " — excellent. Two sessions like this in a row and you graduate this contrast."
            : ". Keep drilling — clean reps teach your mouth faster than perfect scores."}
        </p>
        <ul className="flex flex-wrap justify-center gap-2">
          {results.map((r, i) => (
            <li
              key={i}
              className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-sm text-neutral-800"
            >
              {trials[i].word}{" "}
              <span className={`font-medium ${scoreColor(r.phonemeAccuracy)}`}>
                {r.phonemeAccuracy ?? "—"}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button
            onClick={restart}
            className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Another round
          </button>
          <Link
            href="/drills/speaking"
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
    <div className="flex flex-col items-center gap-5 py-4">
      <p className="text-sm text-neutral-500">
        {index + 1} / {trials.length}
      </p>
      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
        target sound: <span className="font-mono font-semibold">/{trial.phoneme}/</span>
      </span>
      <p className="text-4xl font-semibold text-neutral-900">{trial.word}</p>

      {stage === "prompt" && recorder.status === "recorded" ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />
          <p className="text-sm text-neutral-600">Scoring…</p>
        </div>
      ) : stage === "feedback" && result ? (
        <>
          <div className="flex flex-col items-center gap-1">
            <span className={`text-5xl font-bold tabular-nums ${scoreColor(result.phonemeAccuracy)}`}>
              {result.phonemeAccuracy ?? "—"}
            </span>
            <p className="text-sm text-neutral-600">
              {result.phonemeAccuracy === null
                ? "Couldn't hear the word clearly — check your mic and try the next one."
                : result.passed
                  ? "Nailed it."
                  : result.phonemeAccuracy >= 50
                    ? "Close — check the tip below and try the next one."
                    : "Not yet — check the tip below."}
              {result.wordAccuracy !== null && ` Whole word: ${result.wordAccuracy}.`}
            </p>
            {result.mode === "mock" && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">
                demo scores — no Azure key
              </span>
            )}
          </div>

          <ul className="flex flex-wrap justify-center gap-1.5">
            {result.phonemes.map((p, i) => (
              <li
                key={i}
                className={`rounded-lg px-2 py-1 font-mono text-sm ${
                  p.phoneme.toLowerCase() === trial.phoneme
                    ? "bg-blue-50 ring-1 ring-blue-300"
                    : "bg-neutral-100"
                }`}
              >
                /{p.phoneme}/ <span className={scoreColor(p.accuracy)}>{p.accuracy ?? "—"}</span>
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            <button
              onClick={playModel}
              className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              🔊 Model
            </button>
            <button
              onClick={playOwn}
              className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              🔊 You
            </button>
          </div>

          {!result.passed && <ArticulationCard phoneme={trial.phoneme} />}

          <button
            onClick={next}
            className="rounded-full bg-neutral-900 px-8 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            {index + 1 >= trials.length ? "See score" : "Next"}
          </button>
        </>
      ) : (
        <>
          <button
            onClick={playModel}
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            🔊 Hear the model
          </button>
          {recorder.status === "recording" ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono tabular-nums text-neutral-900">
                  {recorder.seconds}s
                </span>
              </div>
              <button
                onClick={recorder.stop}
                className="rounded-full border-2 border-neutral-900 px-8 py-2.5 font-medium text-neutral-900 transition hover:bg-neutral-100"
              >
                Stop
              </button>
            </div>
          ) : recorder.status === "requesting" ? (
            <p className="py-2 text-sm text-neutral-600">Waiting for microphone access…</p>
          ) : (
            <>
              <button
                onClick={() => {
                  setSubmitError(null);
                  void recorder.start();
                }}
                className="rounded-full bg-neutral-900 px-8 py-3 font-medium text-white transition hover:bg-neutral-700"
              >
                ● Record yourself
              </button>
              <p className="text-xs text-neutral-500">
                Listen first, then say “{trial.word}” — it scores automatically when you stop.
              </p>
            </>
          )}
          {recorder.error && <p className="text-center text-sm text-red-600">{recorder.error}</p>}
          {submitError && <p className="text-center text-sm text-red-600">{submitError}</p>}
        </>
      )}
    </div>
  );
}
