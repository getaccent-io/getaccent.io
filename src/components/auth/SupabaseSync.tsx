"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { syncDrillSessions } from "@/features/drills/sync";

/**
 * Invisible app-wide mount that reconciles localStorage drill progress with
 * Supabase on load (existing session) and on every sign-in. Sync is
 * idempotent, so extra runs are harmless.
 */
export function SupabaseSync() {
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void syncDrillSessions();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void syncDrillSessions();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return null;
}
