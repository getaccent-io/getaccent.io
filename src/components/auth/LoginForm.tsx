"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

type Status =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "signed-in"; email: string }
  | { kind: "error"; message: string };

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setStatus(user?.email ? { kind: "signed-in", email: user.email } : { kind: "signed-out" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setStatus(user?.email ? { kind: "signed-in", email: user.email } : { kind: "signed-out" });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured()) {
    return (
      <p className="text-sm leading-relaxed text-neutral-600">
        Accounts aren&apos;t set up on this install, so drill progress stays in this
        browser&apos;s storage. To enable sync, create a Supabase project, run{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5">supabase/schema.sql</code>, and
        put the project URL + anon key in{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5">.env.local</code>.
      </p>
    );
  }

  if (status.kind === "loading") {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (status.kind === "signed-in") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-700">
          Signed in as <span className="font-medium">{status.email}</span>. Your drill progress
          syncs to your account on every finished session.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => void getSupabase()?.auth.signOut()}
            className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Sign out
          </button>
          <Link
            href="/drills"
            className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            To the drills
          </Link>
        </div>
      </div>
    );
  }

  if (status.kind === "sent") {
    return (
      <p className="text-sm leading-relaxed text-neutral-700">
        Check your email — the sign-in link lands you back here. Progress made on this device
        (including before signing up) uploads automatically once you&apos;re in.
      </p>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !email.trim()) return;
    setStatus({ kind: "sending" });
    void supabase.auth
      .signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/login" },
      })
      .then(({ error }) => {
        setStatus(error ? { kind: "error", message: error.message } : { kind: "sent" });
      });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-neutral-600">
        No password — you get a sign-in link by email. Signing in keeps your drill progress
        across devices; without it, progress lives in this browser only.
      </p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-500"
      />
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60"
      >
        {status.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {status.kind === "error" && <p className="text-sm text-red-600">{status.message}</p>}
    </form>
  );
}
