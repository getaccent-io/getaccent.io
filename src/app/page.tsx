import Link from "next/link";
import { AuthBadge } from "@/components/auth/AuthBadge";
import { AccentToggle } from "@/components/ui/AccentToggle";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900">getaccent.io</h1>
        <p className="mt-3 max-w-md text-neutral-600">
          English pronunciation coaching for Korean speakers. Read one paragraph and get a
          breakdown of exactly which sounds need work.
        </p>
      </div>
      <AccentToggle />
      <Link
        href="/assess"
        className="rounded-full bg-neutral-900 px-8 py-3 font-medium text-white transition hover:bg-neutral-700"
      >
        Read your first paragraph
      </Link>
      <p className="text-xs text-neutral-400">~1 minute · microphone required</p>
      <Link
        href="/drills"
        className="text-sm font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-800"
      >
        or go straight to drills →
      </Link>
      <AuthBadge />
    </main>
  );
}
