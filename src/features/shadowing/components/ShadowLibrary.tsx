"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  isSinglePassageWork,
  passageHref,
  passagesInWork,
  worksInCollection,
  type ShadowCollection,
} from "../library";
import { allProgress, type PassageProgress } from "../progress";
import { PassageCard } from "./PassageCard";

/** A collection's contents, one card per work. A single-passage work collapses
 *  to a direct passage link; a multi-passage work links to its contents page. */
export function ShadowLibrary({ collection }: { collection: ShadowCollection }) {
  // Progress lives in localStorage; read it after mount to avoid hydration
  // mismatches between server and client renders.
  const [progress, setProgress] = useState<Record<string, PassageProgress> | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setProgress(allProgress()), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {worksInCollection(collection).map((work) => {
        const passages = passagesInWork(work.id);

        // Collapse: one passage → link straight to the player.
        if (isSinglePassageWork(work)) {
          const passage = passages[0];
          return (
            <PassageCard
              key={work.id}
              passage={passage}
              href={passageHref(passage)}
              progress={progress?.[passage.id]}
            />
          );
        }

        // Multi-passage work → a card into its contents page.
        const done = passages.filter((p) => {
          const pr = progress?.[p.id];
          return pr && pr.completions > 0 && pr.resumeIndex === null;
        }).length;
        return (
          <Link
            key={work.id}
            href={`/shadowing/${collection}/${work.id}`}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">{work.title}</h3>
              {progress && done > 0 ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  {done}/{passages.length} done
                </span>
              ) : (
                <span className="text-xs text-neutral-400">
                  {passages.length} passages
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              {work.source} · {passages.length} passages
            </p>
          </Link>
        );
      })}
    </div>
  );
}
