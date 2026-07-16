import Link from "next/link";
import { notFound } from "next/navigation";
import { ShadowingPlayer } from "@/features/shadowing";
import {
  getShadowCollection,
  getShadowPassage,
  getShadowWork,
  isSinglePassageWork,
  SHADOW_PASSAGES,
} from "@/features/shadowing/library";

export function generateStaticParams() {
  return SHADOW_PASSAGES.map((p) => ({
    collection: p.collection,
    work: p.workId,
    passage: p.id,
  }));
}

export default async function ShadowingPassagePage({
  params,
}: {
  params: Promise<{ collection: string; work: string; passage: string }>;
}) {
  const { collection: collectionId, work: workId, passage: passageId } = await params;
  const collection = getShadowCollection(collectionId);
  const work = getShadowWork(workId);
  const passage = getShadowPassage(passageId);
  if (
    !collection ||
    !work ||
    !passage ||
    passage.collection !== collection.id ||
    passage.workId !== work.id
  ) {
    notFound();
  }

  // A single-passage work has no contents page worth returning to, so back
  // goes to the collection; a multi-passage work returns to its contents.
  const single = isSinglePassageWork(work);
  const backHref = single
    ? `/shadowing/${collection.id}`
    : `/shadowing/${collection.id}/${work.id}`;
  const backLabel = single ? collection.label : work.title;

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href={backHref}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
          >
            ← {backLabel}
          </Link>
          <h1 className="text-sm font-medium text-neutral-500">{passage.title}</h1>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <ShadowingPlayer passage={passage} backHref={backHref} backLabel={backLabel} />
        </div>
      </div>
    </main>
  );
}
