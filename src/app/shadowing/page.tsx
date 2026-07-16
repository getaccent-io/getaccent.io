import Link from "next/link";
import { SHADOW_COLLECTIONS, SHADOW_PASSAGES } from "@/features/shadowing/library";

export const metadata = {
  title: "Shadowing — getaccent.io",
};

export default function ShadowingPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-800">
            ← getaccent.io
          </Link>
          <h1 className="text-sm font-medium text-neutral-500">Shadowing</h1>
        </div>

        <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-neutral-900">Why shadow?</h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            Drills fix single sounds — shadowing fixes everything around them: rhythm, word
            stress, and melody, which carry more of an accent than any one sound. You hear the
            whole passage once, then it plays one sentence at a time and gives you space to say
            it back, copying the music of the sentence as closely as you can. Ten minutes a day
            on a passage you care about beats an hour once a week.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {SHADOW_COLLECTIONS.map((c) => {
            const count = SHADOW_PASSAGES.filter((p) => p.collection === c.id).length;
            return (
              <Link
                key={c.id}
                href={`/shadowing/${c.id}`}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-neutral-900">
                    {c.emoji} {c.label}
                  </h2>
                  <span className="text-xs font-medium text-neutral-400">
                    {count} passage{count > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-600">{c.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
