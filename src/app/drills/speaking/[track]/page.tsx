import Link from "next/link";
import { notFound } from "next/navigation";
import { HVPT_TRACKS, getTrack } from "@/constants/minimalPairs";
import { ProductionDrill } from "@/features/drills/speaking";

export function generateStaticParams() {
  return HVPT_TRACKS.map((t) => ({ track: t.id }));
}

export default async function SpeakingDrillPage({
  params,
}: {
  params: Promise<{ track: string }>;
}) {
  const { track: trackId } = await params;
  const track = getTrack(trackId);
  if (!track) notFound();

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/drills/speaking"
            className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
          >
            ← Speaking
          </Link>
          <h1 className="text-sm font-medium text-neutral-500">Say {track.label}</h1>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <ProductionDrill track={track} />
        </div>
      </div>
    </main>
  );
}
