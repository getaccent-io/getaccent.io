import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ so the browser bundle can read them. The anon key is safe to
// expose — Row Level Security (supabase/schema.sql) is what protects rows.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

/**
 * Browser Supabase client, or null when the env keys aren't set — callers
 * treat null as "localStorage-only mode" and skip remote persistence, the
 * same graceful-fallback pattern as the Azure mock.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  client ??= createClient(url, anonKey);
  return client;
}
