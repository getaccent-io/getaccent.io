import Link from "next/link";
import { TrackList } from "@/features/drills/listening";

export const metadata = {
  title: "Ear training — getaccent.io",
};

export default function ListeningDrillsPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/drills"
            className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
          >
            ← Drills
          </Link>
          <h1 className="text-sm font-medium text-neutral-500">Ear training</h1>
        </div>
        <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-neutral-900">Why train your ear?</h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            If you keep mixing up two sounds when speaking, it&apos;s usually because your brain
            files them as the same sound. These drills (HVPT — high-variability phonetic
            training) rebuild that distinction by making you tell the sounds apart across many
            different voices. It feels simple, but it&apos;s one of the best-evidenced methods
            in pronunciation research — and the listening gains transfer to your speaking.
          </p>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-neutral-600">
          Pick a contrast. Each session is 10 words across 6 voices — score 90% twice in a row
          to graduate it.
        </p>
        <TrackList />
      </div>
    </main>
  );
}
