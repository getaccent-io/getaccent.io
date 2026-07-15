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

## Status — phase 1 done, phase 2 started

Phase 2 so far:

- `/drills`: HVPT ear-training (listening) drills — 4 minimal-pair tracks
  (R/L, F/P, V/B, TH/S), 10-trial sessions across 6 different voices,
  progress + graduation (≥90% twice in a row) in localStorage for now.
- Drill audio is pre-generated macOS TTS (`npm run gen:hvpt`) committed under
  `public/audio/drills/hvpt/` — a placeholder with the same file layout
  ElevenLabs audio will use later.
- Assessment results link weak phonemes straight to the matching drill track.
- `npm run smoke` synthesizes real speech, runs it through the full
  assessment pipeline, and prints the profile — use it to verify Azure keys.

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

Not built yet: auth/persistence, speaking drills (production, shadowing),
coaching via Claude, ElevenLabs TTS, payments.

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
      listening/          HVPT + perception tasks (empty)
      speaking/             articulatory instruction, production drills, shadowing (empty)
  components/ui/        shared components
  lib/                   azure client, scoring brain; anthropic / tts to come
  hooks, config, constants, types, styles, providers, utils, mocks
public/
  images/{drills,onboarding}, icons, audio
```
