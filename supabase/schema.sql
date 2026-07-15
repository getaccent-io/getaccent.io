-- Drill session history — the server-side twin of the localStorage stores in
-- src/features/drills (see progressStore.ts for the client shape).
-- Run once: Supabase Dashboard → SQL Editor → paste → Run.

create table if not exists public.drill_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('hvpt', 'production')),
  track_id text not null,
  date timestamptz not null,
  correct integer not null,
  total integer not null,
  created_at timestamptz not null default now(),
  -- One row per finished session; sync upserts against this to stay idempotent.
  unique (user_id, kind, track_id, date)
);

alter table public.drill_sessions enable row level security;

-- Append-only from the app: users read and insert their own rows, nothing else.
create policy "Users read own sessions"
  on public.drill_sessions for select
  using (auth.uid() = user_id);

create policy "Users insert own sessions"
  on public.drill_sessions for insert
  with check (auth.uid() = user_id);
