"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "recording" | "recorded" | "error";

export interface Recorder {
  status: RecorderStatus;
  /** Seconds elapsed while recording / total length once stopped. */
  seconds: number;
  /** The recorded audio, in whatever container the browser produced. */
  blob: Blob | null;
  /** Object URL for playback of the recording. */
  audioUrl: string | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

function pickMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export function useRecorder(): Recorder {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const releaseUrl = useCallback(() => {
    setAudioUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const out = new Blob(chunksRef.current, { type: recorder.mimeType });
        setBlob(out);
        setAudioUrl(URL.createObjectURL(out));
        setStatus("recorded");
      };
      recorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      clearTick();
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setStatus("recording");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser settings and try again."
          : "Could not start the microphone.",
      );
    }
  }, []);

  const stop = useCallback(() => {
    clearTick();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const reset = useCallback(() => {
    clearTick();
    releaseUrl();
    setBlob(null);
    setSeconds(0);
    setError(null);
    setStatus("idle");
  }, [releaseUrl]);

  useEffect(
    () => () => {
      clearTick();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    },
    [],
  );

  return { status, seconds, blob, audioUrl, error, start, stop, reset };
}
