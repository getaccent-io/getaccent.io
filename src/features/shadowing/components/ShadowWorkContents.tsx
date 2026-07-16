"use client";

import { useEffect, useState } from "react";
import { passageHref, passagesInWork } from "../library";
import { allProgress, type PassageProgress } from "../progress";
import { PassageCard } from "./PassageCard";

/** The passages inside one work (e.g. the Psalms in the book of Psalms). */
export function ShadowWorkContents({ workId }: { workId: string }) {
  const [progress, setProgress] = useState<Record<string, PassageProgress> | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setProgress(allProgress()), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {passagesInWork(workId).map((passage) => (
        <PassageCard
          key={passage.id}
          passage={passage}
          href={passageHref(passage)}
          progress={progress?.[passage.id]}
        />
      ))}
    </div>
  );
}
