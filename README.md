# getaccent.io

## Layout

```
src/
  app/                routes + api handlers, nothing else
    api/
      assessment/      Azure pronunciation scoring
      coaching/         Claude adaptive feedback
      tts/              reference audio (ElevenLabs/Azure)
  features/
    onboarding/         read-a-paragraph intake
    recording/           mic capture
    assessment/           turns Azure's output into our error categories
    drills/
      listening/          HVPT + perception tasks
      speaking/             articulatory instruction, production drills, shadowing
  components/ui/        shared components
  lib/                   azure / anthropic / tts clients
  hooks, config, constants, types, styles, providers, utils, mocks
public/
  images/{drills,onboarding}, icons, audio
```