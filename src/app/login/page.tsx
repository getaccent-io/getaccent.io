import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in — getaccent.io",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-800">
            ← getaccent.io
          </Link>
          <h1 className="text-sm font-medium text-neutral-500">Sign in</h1>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
