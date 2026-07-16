import Link from "next/link";
import { notFound } from "next/navigation";
import { ShadowingPlayer } from "@/features/shadowing";
import { getShadowCollection, getShadowPassage, SHADOW_PASSAGES } from "@/features/shadowing/library";

export function generateStaticParams() {
  return SHADOW_PASSAGES.map((p) => ({ collection: p.collection, passage: p.id }));
}

export default async function ShadowingPassagePage({
  params,
}: {
  params: Promise<{ collection: string; passage: string }>;
}) {
  const { collection: collectionId, passage: passageId } = await params;
  const collection = getShadowCollection(collectionId);
  const passage = getShadowPassage(passageId);
  if (!collection || !passage || passage.collection !== collection.id) notFound();

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href={`/shadowing/${collection.id}`}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
          >
            ← {collection.label}
          </Link>
          <h1 className="text-sm font-medium text-neutral-500">{passage.title}</h1>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <ShadowingPlayer passage={passage} />
        </div>
      </div>
    </main>
  );
}
