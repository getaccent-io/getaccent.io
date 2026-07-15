"use client";

import Link from "next/link";
import { PHONEME_TO_TRACK, getTrack } from "@/constants/minimalPairs";
import type { AssessmentResponse, ErrorFinding, WordResult } from "@/types/assessment";

function scoreColor(accuracy: number | null): string {
  if (accuracy === null) return "text-neutral-400";
  if (accuracy >= 80) return "text-emerald-700";
  if (accuracy >= 60) return "text-amber-600";
  return "text-red-600";
}

function wordBg(w: WordResult): string {
  if (w.errorType === "Omission") return "bg-neutral-200 text-neutral-500 line-through";
  if (w.accuracy === null) return "";
  if (w.accuracy >= 80) return "bg-emerald-50 text-emerald-900";
  if (w.accuracy >= 60) return "bg-amber-100 text-amber-900";
  return "bg-red-100 text-red-900";
}

function SeverityBar({ severity }: { severity: number }) {
  const color =
    severity >= 60 ? "bg-red-500" : severity >= 30 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${severity}%` }} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-2xl font-semibold tabular-nums ${scoreColor(value)}`}>
        {value ?? "—"}
      </span>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  );
}

function FindingDetails({ finding }: { finding: ErrorFinding }) {
  if (!finding.detected) return null;

  if (finding.id === "phoneme-production") {
    return (
      <ul className="mt-3 flex flex-wrap gap-2">
        {finding.phonemes.map((p) => {
          const track = getTrack(PHONEME_TO_TRACK[p.phoneme] ?? "");
          return (
            <li
              key={p.phoneme}
              className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-sm text-neutral-800"
              title={`heard in: ${p.exampleWords.join(", ")}`}
            >
              <span className="font-mono font-semibold">/{p.phoneme}/</span>{" "}
              <span className={scoreColor(p.avgAccuracy)}>{p.avgAccuracy}</span>
              {p.koreanTypical && (
                <span className="ml-1.5 rounded bg-blue-100 px-1 py-0.5 text-[10px] font-medium text-blue-800">
                  common for Korean speakers
                </span>
              )}
              {track && (
                <Link
                  href={`/drills/listening/${track.id}`}
                  className="ml-1.5 text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
                >
                  train {track.label} →
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  if (finding.id === "syllable-structure") {
    return (
      <ul className="mt-3 space-y-1 text-sm text-neutral-700">
        {finding.issues.map((i, idx) => (
          <li key={idx}>
            <span className="font-medium">{i.word}</span>{" "}
            <span className="font-mono text-neutral-500">{i.detail}</span>{" "}
            <span className={scoreColor(i.accuracy)}>{i.accuracy}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="mt-3 space-y-1 text-sm text-neutral-700">
      {finding.monotone && <li>Delivery flagged as monotone.</li>}
      {finding.words.map((w, idx) => (
        <li key={idx}>
          <span className="font-medium">{w.word}</span> — weak syllable
          {w.weakSyllables.length > 1 ? "s" : ""}:{" "}
          <span className="font-mono text-neutral-500">{w.weakSyllables.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

export function ResultsView({
  result,
  passageTitle,
  onRetry,
}: {
  result: AssessmentResponse;
  passageTitle: string;
  onRetry: () => void;
}) {
  const { profile, mode } = result;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {mode === "mock" && (
        <p className="rounded-xl bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          Demo mode — no Azure key configured, so these are simulated results.
        </p>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Your results</h2>
          <span className="text-sm text-neutral-500">{passageTitle}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className={`text-5xl font-bold tabular-nums ${scoreColor(profile.overall.pronScore)}`}>
              {profile.overall.pronScore}
            </span>
            <span className="text-sm text-neutral-500">overall</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="accuracy" value={profile.overall.accuracy} />
            <Stat label="fluency" value={profile.overall.fluency} />
            <Stat label="completeness" value={profile.overall.completeness} />
            <Stat label="prosody" value={profile.overall.prosody} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        {profile.findings.map((f) => (
          <div key={f.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">{f.label}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  f.detected ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {f.detected ? "needs work" : "looks good"}
              </span>
            </div>
            <SeverityBar severity={f.severity} />
            <p className="mt-2 text-sm text-neutral-600">{f.summary}</p>
            <FindingDetails finding={f} />
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 font-semibold text-neutral-900">Word by word</h3>
        <p className="text-lg leading-loose">
          {profile.words.map((w, i) => (
            <span key={i}>
              <span
                className={`rounded px-0.5 ${wordBg(w)}`}
                title={
                  w.accuracy === null
                    ? w.errorType
                    : `${w.accuracy}${w.errorType !== "None" ? ` · ${w.errorType}` : ""}`
                }
              >
                {w.word}
              </span>{" "}
            </span>
          ))}
        </p>
        <p className="mt-3 text-xs text-neutral-500">
          Hover a word for its score.{" "}
          <span className="rounded bg-emerald-50 px-1 text-emerald-900">80+</span>{" "}
          <span className="rounded bg-amber-100 px-1 text-amber-900">60–79</span>{" "}
          <span className="rounded bg-red-100 px-1 text-red-900">below 60</span>
        </p>
      </section>

      <div className="mx-auto flex gap-3">
        <button
          onClick={onRetry}
          className="rounded-full border border-neutral-300 px-8 py-3 font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Record again
        </button>
        <Link
          href="/drills"
          className="rounded-full bg-neutral-900 px-8 py-3 font-medium text-white transition hover:bg-neutral-700"
        >
          Start ear training
        </Link>
      </div>
    </div>
  );
}
