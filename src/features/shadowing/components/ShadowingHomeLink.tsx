"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLastAssessment } from "@/features/assessment/lastAssessment";

/**
 * Home-screen link to the main practice loop. Hidden until a real assessment
 * exists, so the first-run home stays a clean onboarding funnel
 * (assess → drills → shadowing).
 */
export function ShadowingHomeLink() {
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setOnboarded(loadLastAssessment() !== null), 0);
    return () => clearTimeout(id);
  }, []);

  if (!onboarded) return null;

  return (
    <Link
      href="/shadowing"
      className="text-sm font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-800"
    >
      continue practice: shadowing →
    </Link>
  );
}
