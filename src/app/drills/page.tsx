import Link from "next/link";

export const metadata = {
  title: "Drills — getaccent.io",
};

export default function DrillsPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-800">
            ← getaccent.io
          </Link>
          <h1 className="text-sm font-medium text-neutral-500">Drills</h1>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/drills/listening"
            className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400"
          >
            <span className="text-2xl">👂</span>
            <h2 className="mt-2 font-semibold text-neutral-900">Ear training</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Learn to hear the difference between sounds across many voices.
            </p>
            <span className="mt-auto pt-3 text-xs font-medium text-neutral-400">4 tracks</span>
          </Link>
          <Link
            href="/drills/speaking"
            className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400"
          >
            <span className="text-2xl">🗣️</span>
            <h2 className="mt-2 font-semibold text-neutral-900">Speaking</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Say the sounds — copy a native model and get scored instantly.
            </p>
            <span className="mt-auto pt-3 text-xs font-medium text-neutral-400">4 tracks</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
