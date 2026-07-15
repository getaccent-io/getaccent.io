import Link from "next/link";
import { RAINBOW_PASSAGE } from "@/constants/passages";
import { AssessmentFlow } from "@/features/assessment";

export const metadata = {
  title: "Assessment — getaccent.io",
};

export default function AssessPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto mb-8 flex max-w-2xl items-center justify-between">
        <Link href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-800">
          ← getaccent.io
        </Link>
        <h1 className="text-sm font-medium text-neutral-500">Pronunciation check</h1>
      </div>
      <AssessmentFlow passage={RAINBOW_PASSAGE} />
    </main>
  );
}
