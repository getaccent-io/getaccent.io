import Link from "next/link";
import { estimateMinutes, type ShadowPassage } from "../library";
import type { PassageProgress } from "../progress";

/** One passage row with its resume/completion badge. Presentational — the
 *  list that renders it owns the localStorage read and passes progress in. */
export function PassageCard({
  passage,
  href,
  progress: p,
}: {
  passage: ShadowPassage;
  href: string;
  progress: PassageProgress | undefined;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-900">{passage.title}</h3>
        {p && p.completions > 0 && p.resumeIndex === null ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            done ×{p.completions}
            {p.lastScore ? ` · last ${p.lastScore.pron}` : ""}
          </span>
        ) : p && p.resumeIndex !== null && p.resumeIndex > 0 ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            resume at {p.resumeIndex + 1}/{passage.sentences.length}
          </span>
        ) : (
          <span className="text-xs text-neutral-400">not started</span>
        )}
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        {passage.source} · {passage.sentences.length} sentences · ~
        {estimateMinutes(passage.sentences.length)} min
        {passage.difficulty ? ` · ${passage.difficulty}` : ""}
      </p>
      {passage.license ? (
        <p className="mt-1 text-xs text-neutral-400">{passage.license}</p>
      ) : null}
    </Link>
  );
}
