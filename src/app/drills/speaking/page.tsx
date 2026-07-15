import Link from "next/link";
import { SpeakingTrackList } from "@/features/drills/speaking";

export const metadata = {
  title: "Speaking drills — getaccent.io",
};

export default function SpeakingDrillsPage() {
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
          <h1 className="text-sm font-medium text-neutral-500">Speaking</h1>
        </div>
        <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-neutral-900">Why drill speaking?</h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            Hearing the difference is only half the job — your mouth needs its own reps. Each
            drill gives you the exact mouth position, a native model to copy, and an instant
            score on the sound you&apos;re training. If a sound is brand new to you, graduate
            its ear track first: it&apos;s hard to say a difference you can&apos;t hear.
          </p>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-neutral-600">
          Pick a contrast. Each session is 10 words — score 90% twice in a row to graduate it.
        </p>
        <SpeakingTrackList />
      </div>
    </main>
  );
}
