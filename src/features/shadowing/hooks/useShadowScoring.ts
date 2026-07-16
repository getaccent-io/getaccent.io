"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { blobToWav16kMono } from "@/features/recording/utils/wav";
import type { Accent } from "@/lib/accent";
import type { AssessmentResponse } from "@/types/assessment";

// Records the learner during shadow gaps and scores each attempt against its
// sentence via /api/assessment — asynchronously, so the shadowing rhythm
// never waits on Azure. One MediaStream lives for the whole session (one
// permission prompt, no per-sentence init latency); each gap gets its own
// MediaRecorder. Latest attempt per sentence wins.

export type SentenceScore =
  | { status: "pending" }
  | { status: "skipped" } // nothing heard in the gap
  | { status: "failed" }
  | {
      status: "scored";
      pron: number;
      accuracy: number;
      fluency: number;
      prosody: number | null;
      mode: "azure" | "mock";
    };

async function scoreSentence(wav: Blob, sentence: string, accent: Accent): Promise<AssessmentResponse> {
  const form = new FormData();
  form.append("audio", new File([wav], "shadow.wav", { type: "audio/wav" }));
  form.append("referenceText", sentence);
  form.append("source", "shadowing");
  form.append("accent", accent);
  const res = await fetch("/api/assessment", { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as AssessmentResponse;
}

export function useShadowScoring() {
  /** null = not asked yet; false = declined/unavailable; true = mic live. */
  const [micReady, setMicReady] = useState<boolean | null>(null);
  const [results, setResults] = useState<Record<number, SentenceScore>>({});
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startSession = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    try {
      // Echo cancellation matters here: the model clip plays from the
      // speakers moments before (and sometimes while) the learner shadows.
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setMicReady(true);
      return true;
    } catch {
      setMicReady(false);
      return false;
    }
  }, []);

  const beginClip = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start();
  }, []);

  /** Stop the current clip and score it against `sentence` in the background. */
  const endClip = useCallback((index: number, sentence: string, accent: Accent) => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder || recorder.state === "inactive") return;
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      // A near-empty container means the gap was silent air, not an attempt.
      if (blob.size < 1024) {
        setResults((r) => ({ ...r, [index]: { status: "skipped" } }));
        return;
      }
      setResults((r) => ({ ...r, [index]: { status: "pending" } }));
      void (async () => {
        try {
          const res = await scoreSentence(await blobToWav16kMono(blob), sentence, accent);
          const o = res.profile.overall;
          // Silence comes back as a 200 with nothing recognized (no words,
          // completeness 0) — that's "didn't attempt", not a zero.
          if (res.profile.words.length === 0 || o.completeness === 0) {
            setResults((r) => ({ ...r, [index]: { status: "skipped" } }));
            return;
          }
          setResults((r) => ({
            ...r,
            [index]: {
              status: "scored",
              pron: o.pronScore,
              accuracy: o.accuracy,
              fluency: o.fluency,
              prosody: o.prosody,
              mode: res.mode,
            },
          }));
        } catch (err) {
          // "was the audio silent?" (Azure) and "Recording is empty" (the
          // WAV converter) both mean no attempt, not a failure.
          const silent = err instanceof Error && /silent|empty/i.test(err.message);
          setResults((r) => ({ ...r, [index]: { status: silent ? "skipped" : "failed" } }));
        }
      })();
    };
    recorder.stop();
  }, []);

  /** Stop the current clip without scoring (replay, going back). */
  const discardClip = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder || recorder.state === "inactive") return;
    recorder.onstop = null;
    recorder.ondataavailable = null;
    recorder.stop();
  }, []);

  const pauseClip = useCallback(() => {
    const r = recorderRef.current;
    if (r?.state === "recording") r.pause();
  }, []);

  const resumeClip = useCallback(() => {
    const r = recorderRef.current;
    if (r?.state === "paused") r.resume();
  }, []);

  const resetResults = useCallback(() => setResults({}), []);

  // Release the mic when the player unmounts.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return {
    micReady,
    results,
    startSession,
    beginClip,
    endClip,
    discardClip,
    pauseClip,
    resumeClip,
    resetResults,
  };
}
