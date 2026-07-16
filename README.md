# getaccent.io

English pronunciation coaching for Korean speakers. Read a paragraph, get a
diagnosis of exactly which sounds need work, then fix them with drills.

## Running it

```
npm install
npm run dev        # http://localhost:3000
```

Works out of the box with **no credentials**: without an Azure key,
`/api/assessment` returns deterministic simulated results (a "Demo mode"
banner shows on the results screen). To use real scoring, copy `.env.example`
to `.env.local` and fill in `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`
(Azure AI Services → Speech).

In dev there's a "skip mic" link on the assess page that submits sample audio,
so the whole flow can be exercised without a microphone.

Accounts are optional too: set `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (create a Supabase project and run
`supabase/schema.sql` once) and magic-link sign-in syncs drill progress
across devices. Without them, progress lives in the browser's localStorage.

## Status — phase 1 done, phase 2 started

Phase 2 so far:

- `/drills`: chooser between ear training and speaking, each with 4
  minimal-pair tracks (R/L, F/P, V/B, TH/S).
- `/drills/listening`: HVPT ear-training drills — 10-trial sessions across
  6 different voices, progress + graduation (≥90% twice in a row).
- `/drills/speaking`: production drills — articulation instructions, a
  native model to copy, record yourself, Azure scores the target phoneme
  instantly, model/self compare playback. Same session/graduation mechanics.
- Optional Supabase accounts (magic-link email): drill sessions write
  through on finish and two-way sync on sign-in; localStorage remains the
  UI's source of truth and the only store when keys are unset.
- US/UK accent toggle on the home screen: assessment scores against the
  matching Azure locale (en-US / en-GB) and drills play the matching audio
  bank. Azure only names phonemes for en-US — en-GB returns scored but
  nameless slots — so UK results get names re-attached from a committed
  template (`src/lib/scoring/ukPhonemes.ts`, built by
  `scripts/build-uk-phoneme-names.mjs`), keeping findings and drill links
  accent-blind.
- Drill audio is two pre-generated multi-voice banks (`us/`, `uk/`)
  committed under `public/audio/drills/hvpt/`, 6 Azure neural voices each.
  The generator (`npm run gen:hvpt -- --accent us|uk`) is provider-pluggable
  — ElevenLabs, Azure, Google Chirp, or macOS `say` — and the app only reads
  the manifest + file layout, so switching voices never touches app code.
- `/shadowing`: the main practice loop — collection → work → passage
  (`/shadowing/[collection]/[work]/[passage]`). Pick a collection (Bible in
  the public-domain WEB translation, Classics), then a work (a Bible book, a
  story, a speech), then a passage. A work with one passage collapses
  straight to the player; a multi-passage work (e.g. Psalms) shows a
  contents page first. Passages carry optional facets (`license` attribution,
  `difficulty`) that annotate rather than nest. Library baked into
  `src/constants/shadowingLibrary.json`.
  The player reads the passage through once, then sentence-by-sentence
  with timed gaps to shadow out loud. Pause / replay / back / next, 0.85×
  slow toggle, resume position per passage. Audio is pre-generated per
  accent (one narrative voice each) under `public/audio/shadowing/`.
- Scored shadows (opt-in, default on): the mic records only during your
  gap, each attempt is scored against its sentence in the background
  (never blocking the loop), live per-sentence chips during practice, a
  summary + per-sentence breakdown at the end, and the last session score
  on the library card. Silent gaps count as "skipped", not zero.
- First-run funnel: home stays assess-first until a real assessment exists,
  then a "continue practice: shadowing" link appears; drill finish screens
  and the results drill plan also hand off to shadowing.
- Results end in a ranked drill plan ("Your drill plan", weakest sound
  first): weak phonemes and weak cluster/ending sounds map to their tracks
  with ear-training + speaking links. The plan is computed in the scoring
  brain (`profile.recommendations`), persists in localStorage after real
  assessments, and `/drills` shows a start-here banner + "recommended"
  badges on matching tracks.
- `npm run smoke` synthesizes real speech, runs it through the full
  assessment pipeline, and prints the profile — use it to verify Azure keys
  (`-- --accent uk` exercises the British path).

Phase 1:

- `/assess`: record the Rainbow Passage in-browser → 16 kHz mono WAV built
  client-side (no server ffmpeg) → Azure Pronunciation Assessment (phoneme
  granularity + prosody, continuous recognition so >60s audio works).
- `src/lib/scoring/errorProfile.ts` is the diagnosis brain: raw Azure JSON →
  findings for errors 1–3 of the taxonomy (phoneme production, syllable
  structure, word stress). Syllable structure and word stress are heuristic
  proxies — Azure has no direct epenthesis/stress signal; thresholds live at
  the top of that file and will need tuning against real recordings.
- Results screen: overall scores, per-error findings with severity,
  word-by-word heatmap.

Not built yet: paste-your-own shadowing text, whole-Bible picker, storing
assessment recordings (blocked on consent/retention decisions), coaching via
Claude, payments.

## Layout

```
src/
  app/                routes + api handlers, nothing else
    api/
      assessment/      Azure pronunciation scoring (mock fallback without keys)
      coaching/         Claude adaptive feedback (empty)
      tts/              reference audio, ElevenLabs/Azure (empty)
  features/
    onboarding/         read-a-paragraph intake (empty)
    recording/           mic capture + WAV conversion
    assessment/           record→assess flow UI + results
    drills/
      listening/          HVPT ear training (live)
      speaking/             production drills (live)
    shadowing/             passage library + listen/shadow loop (live)
  components/            shared components (ui, auth)
  lib/                   azure + supabase clients, scoring brain; anthropic / tts to come
  hooks, config, constants, types, styles, providers, utils, mocks
public/
  images/{drills,onboarding}, icons, audio
```
