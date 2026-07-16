"use client";

import { useState } from "react";
import type { Passage } from "@/constants/passages";
import { useRecorder } from "@/features/recording/hooks/useRecorder";
import { blobToWav16kMono, silentWav } from "@/features/recording/utils/wav";
import { getAccent } from "@/lib/accent";
import type { AssessmentResponse } from "@/types/assessment";
import { ResultsView } from "./ResultsView";

type Phase = "record" | "submitting" | "results";

async function submitAssessment(wav: Blob, referenceText: string): Promise<AssessmentResponse> {
  const form = new FormData();
  form.append("audio", new File([wav], "recording.wav", { type: "audio/wav" }));
  form.append("referenceText", referenceText);
  form.append("accent", getAccent());
  const res = await fetch("/api/assessment", { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as AssessmentResponse;
}

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function AssessmentFlow({ passage }: { passage: Passage }) {
  const recorder = useRecorder();
  const [phase, setPhase] = useState<Phase>("record");
  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async (wavPromise: Promise<Blob> | Blob) => {
    setPhase("submitting");
    setSubmitError(null);
    try {
      const wav = await wavPromise;
      const res = await submitAssessment(wav, passage.text);
      setResult(res);
      setPhase("results");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("record");
    }
  };

  const startOver = () => {
    recorder.reset();
    setResult(null);
    setSubmitError(null);
    setPhase("record");
  };

  if (phase === "results" && result) {
    return (
      <ResultsView
        result={result}
        passageTitle={passage.title}
        audioUrl={recorder.audioUrl}
        onRetry={startOver}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">{passage.title}</h2>
          <span className="text-sm text-neutral-500">~{passage.approxSeconds}s read</span>
        </div>
        <p className="text-lg leading-relaxed text-neutral-800">{passage.text}</p>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        {phase === "submitting" ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />
            <p className="text-sm text-neutral-600">Analyzing your pronunciation…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {recorder.status === "idle" || recorder.status === "error" ? (
              <>
                <p className="text-center text-sm text-neutral-600">
                  Read the paragraph above aloud at a natural pace. Find a quiet spot.
                </p>
                <button
                  onClick={recorder.start}
                  className="rounded-full bg-neutral-900 px-8 py-3 font-medium text-white transition hover:bg-neutral-700"
                >
                  Start recording
                </button>
                {recorder.error && (
                  <p className="text-center text-sm text-red-600">{recorder.error}</p>
                )}
              </>
            ) : recorder.status === "requesting" ? (
              <p className="py-4 text-sm text-neutral-600">Waiting for microphone access…</p>
            ) : recorder.status === "recording" ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                  <span className="font-mono text-2xl tabular-nums text-neutral-900">
                    {formatTime(recorder.seconds)}
                  </span>
                </div>
                <button
                  onClick={recorder.stop}
                  className="rounded-full border-2 border-neutral-900 px-8 py-3 font-medium text-neutral-900 transition hover:bg-neutral-100"
                >
                  Stop
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-neutral-600">
                  {formatTime(recorder.seconds)} recorded — listen back, then submit.
                </p>
                {recorder.audioUrl && (
                  <audio controls src={recorder.audioUrl} className="w-full max-w-sm" />
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => recorder.reset()}
                    className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                  >
                    Re-record
                  </button>
                  <button
                    onClick={() => recorder.blob && submit(blobToWav16kMono(recorder.blob))}
                    className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
                  >
                    Get my results
                  </button>
                </div>
              </>
            )}
            {submitError && <p className="text-center text-sm text-red-600">{submitError}</p>}
            {process.env.NODE_ENV === "development" &&
              (recorder.status === "idle" || recorder.status === "error") && (
                <button
                  onClick={() => submit(silentWav())}
                  className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600"
                >
                  dev: skip mic, submit sample audio
                </button>
              )}
          </div>
        )}
      </section>
    </div>
  );
}
