import Link from "next/link";
import { notFound } from "next/navigation";
import { ShadowWorkContents } from "@/features/shadowing";
import {
  getShadowCollection,
  getShadowWork,
  SHADOW_WORKS,
} from "@/features/shadowing/library";

export function generateStaticParams() {
  return SHADOW_WORKS.map((w) => ({ collection: w.collection, work: w.id }));
}

export default async function ShadowingWorkPage({
  params,
}: {
  params: Promise<{ collection: string; work: string }>;
}) {
  const { collection: collectionId, work: workId } = await params;
  const collection = getShadowCollection(collectionId);
  const work = getShadowWork(workId);
  if (!collection || !work || work.collection !== collection.id) notFound();

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href={`/shadowing/${collection.id}`}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
          >
            ← {collection.emoji} {collection.label}
          </Link>
          <h1 className="text-sm font-medium text-neutral-500">{work.title}</h1>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-neutral-600">
          Pick a passage. Your position saves as you go — coming back to the same passage
          beats starting a new one.
        </p>
        <ShadowWorkContents workId={work.id} />
      </div>
    </main>
  );
}
