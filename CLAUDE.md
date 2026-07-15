# getaccent.io

English pronunciation coaching for Korean speakers. Two-feature product:
FIND errors (Azure Pronunciation Assessment) → FIX errors (drills).

## Session startup

1. Read the **Status** section of README.md — it says what's built and what isn't.
2. If a `notes/` folder exists (gitignored, founder-internal), read the most
   recent file — it has current state, known issues, and what to work on next.
3. Don't rebuild or redesign existing pages unless explicitly asked.

## Commands

- `npm run dev` — dev server on :3000
- `npm run smoke` — synthesizes real speech, runs the full assessment
  pipeline, prints the profile. Run after touching the audio/Azure path.
- `npm run gen:hvpt` — regenerate drill audio bank (macOS only)
- `npm run typecheck && npm run lint` — run both before committing
- Dev without a mic: the /assess page has a dev-only "skip mic" button.

## Key facts

- Azure keys live in `.env.local` (gitignored, never commit). Without them
  the API serves deterministic mock results — the app still fully works.
- The scoring "brain" is `src/lib/scoring/errorProfile.ts`. Its thresholds
  are heuristic and known to false-positive on errors 2–3 (syllable
  structure, word stress) — tune against real recordings, don't trust blindly.
- HVPT drill audio must stay multi-voice (that's the point of HVPT). Current
  audio is macOS TTS placeholder for ElevenLabs, same file layout.
- Drill progress is localStorage (`src/features/drills/listening/progress.ts`),
  shaped to migrate to a future Supabase `drill_sessions` table.
- `src/features/*` layout: components/hooks per feature, `src/lib` for
  clients and scoring, `src/app` only routes and API handlers.

## Conventions

- `notes/` = founder-internal, gitignored. Put session handoff notes there.
- Commit messages: `feat:`/`fix:`/`chore:` style, imperative.
- Push to `main` on getaccent-io/getaccent.io (org repo, public).
