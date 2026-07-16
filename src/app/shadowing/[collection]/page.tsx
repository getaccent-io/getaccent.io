import Link from "next/link";
import { notFound } from "next/navigation";
import { ShadowLibrary } from "@/features/shadowing";
import { getShadowCollection, SHADOW_COLLECTIONS } from "@/features/shadowing/library";

export function generateStaticParams() {
  return SHADOW_COLLECTIONS.map((c) => ({ collection: c.id }));
}

export default async function ShadowingCollectionPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection: collectionId } = await params;
  const collection = getShadowCollection(collectionId);
  if (!collection) notFound();

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/shadowing"
            className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
          >
            ← Shadowing
          </Link>
          <h1 className="text-sm font-medium text-neutral-500">
            {collection.emoji} {collection.label}
          </h1>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-neutral-600">
          Pick a passage. Your position saves as you go — coming back to the same passage
          beats starting a new one.
        </p>
        <ShadowLibrary collection={collection.id} />
      </div>
    </main>
  );
}
