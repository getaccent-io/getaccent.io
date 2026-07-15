"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Tiny account indicator: "Sign in" link when signed out, email + sign-out
 * when signed in. Renders nothing while loading or when Supabase isn't
 * configured (localStorage-only installs have no accounts to show).
 */
export function AuthBadge() {
  const [state, setState] = useState<{ ready: boolean; email: string | null }>({
    ready: false,
    email: null,
  });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setState({ ready: true, email: data.session?.user.email ?? null });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ ready: true, email: session?.user.email ?? null });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!state.ready) return null;

  if (!state.email) {
    return (
      <Link
        href="/login"
        className="text-xs font-medium text-neutral-400 underline underline-offset-2 hover:text-neutral-600"
      >
        Sign in to sync progress
      </Link>
    );
  }

  return (
    <span className="text-xs text-neutral-400">
      {state.email} ·{" "}
      <button
        onClick={() => void getSupabase()?.auth.signOut()}
        className="font-medium underline underline-offset-2 hover:text-neutral-600"
      >
        sign out
      </button>
    </span>
  );
}
