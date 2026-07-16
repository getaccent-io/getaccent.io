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
  `-- --accent uk` for the British path.
- `npm run gen:hvpt` — regenerate one accent's drill audio bank;
  `-- --accent us|uk --provider elevenlabs|azure|google|macos`
  (defaults: us, first provider with keys in `.env.local`)
- `npm run typecheck && npm run lint` — run both before committing
- Dev without a mic: the /assess page has a dev-only "skip mic" button.

## Key facts

- Azure keys live in `.env.local` (gitignored, never commit). Without them
  the API serves deterministic mock results — the app still fully works.
- The scoring "brain" is `src/lib/scoring/errorProfile.ts`. Its thresholds
  are heuristic and known to false-positive on errors 2–3 (syllable
  structure, word stress) — tune against real recordings, don't trust blindly.
- HVPT drill audio must stay multi-voice (that's the point of HVPT). Two
  banks — one per accent (`us/`, `uk/`, home-screen toggle) — of Azure
  neural voices; the app's only contract is `{accent}/manifest.json` + the
  file layout, so regenerating with another provider (ElevenLabs/Google/
  macOS) needs no code change. After any regen, spot-check the heteronyms
  (read/lead/bow) — see note in the gen script.
- Azure names phonemes only for en-US; en-GB returns scored but NAMELESS
  slots. UK results get names re-attached from a committed template
  (`src/lib/scoring/ukPhonemeNames.json`). Rerun
  `scripts/build-uk-phoneme-names.mjs` whenever the passage or the drill
  word list changes, or UK phoneme findings silently degrade.
- Drill progress is localStorage (`src/features/drills/listening/progress.ts`),
  shaped to migrate to a future Supabase `drill_sessions` table.
- `src/features/*` layout: components/hooks per feature, `src/lib` for
  clients and scoring, `src/app` only routes and API handlers.

## Conventions

- `notes/` = founder-internal, gitignored. Put session handoff notes there.
- Commit messages: `feat:`/`fix:`/`chore:` style, imperative.
- Push to `main` on getaccent-io/getaccent.io (org repo, public).
