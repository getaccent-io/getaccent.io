"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLastAssessment, type LastAssessment } from "../lastAssessment";

/**
 * "From your last assessment, start with X →" strip for the drills chooser.
 * Renders nothing until a real (non-mock) assessment has produced
 * recommendations.
 */
export function RecommendationBanner() {
  const [last, setLast] = useState<LastAssessment | null>(null);

  useEffect(() => {
    // Deferred past hydration, same as the track lists.
    const id = setTimeout(() => setLast(loadLastAssessment()), 0);
    return () => clearTimeout(id);
  }, []);

  const top = last?.recommendations[0];
  if (!top) return null;

  return (
    <Link
      href={`/drills/listening/${top.trackId}`}
      className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 transition hover:border-blue-400"
    >
      <span className="text-sm text-neutral-800">
        From your last assessment: start with{" "}
        <span className="font-semibold">{top.trackLabel}</span> ear training
        <span className="ml-2 text-neutral-500">({top.reason})</span>
      </span>
      <span className="text-sm font-medium text-blue-700">Start →</span>
    </Link>
  );
}
