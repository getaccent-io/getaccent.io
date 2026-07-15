// Articulatory instruction for the sounds the speaking drills train — the
// explicit scaffolding layer (tongue position, lip shape, voicing) the
// production-drill literature calls for before attempts. Text placeholder for
// a future 30–60s video/animation per sound; keyed by the same SAPI symbols
// Azure and minimalPairs use.

export interface ArticulationGuide {
  /** SAPI phoneme symbol, matching Azure + minimalPairs. */
  phoneme: string;
  /** A drill word containing the sound, shown as /r/ as in "right". */
  example: string;
  /** How to physically make the sound. */
  how: string;
  /** The trap Korean speakers typically fall into with this sound. */
  pitfall: string;
}

export const ARTICULATION: Record<string, ArticulationGuide> = {
  r: {
    phoneme: "r",
    example: "right",
    how: "Pull your tongue tip up and back so it floats in the middle of your mouth — touching nothing. Round your lips slightly and let the sound hum out.",
    pitfall:
      "Korean ㄹ taps the ridge behind the teeth. If your tongue touches anything, an English ear hears /l/.",
  },
  l: {
    phoneme: "l",
    example: "light",
    how: "Press your tongue tip firmly against the ridge just behind your upper teeth and hold it there — the sound flows around the sides of the tongue.",
    pitfall:
      "Don't tap and release like ㄹ. Keep the tongue planted for the whole sound.",
  },
  f: {
    phoneme: "f",
    example: "fan",
    how: "Rest your upper teeth lightly on your lower lip and blow air through the gap. No voice — just steady friction.",
    pitfall:
      "Korean ㅍ uses both lips. If your lips touch each other, it becomes /p/ — 'coffee' turns into 'copy'.",
  },
  p: {
    phoneme: "p",
    example: "pan",
    how: "Close both lips, let air pressure build, and release it in one small puff.",
    pitfall:
      "The contrast with /f/: /p/ pops once from both lips; /f/ blows continuously with teeth on lip.",
  },
  v: {
    phoneme: "v",
    example: "very",
    how: "Same position as /f/ — upper teeth on lower lip — but switch your voice on. Your lower lip should buzz.",
    pitfall:
      "Korean has no /v/, so the habit is /b/ with both lips. If your lips touch each other, it's /b/ — 'very' becomes 'berry'.",
  },
  b: {
    phoneme: "b",
    example: "berry",
    how: "Close both lips and release once, voice on from the start. One clean pop, no friction.",
    pitfall:
      "The contrast with /v/: /b/ releases once; /v/ buzzes continuously with teeth on lip.",
  },
  th: {
    phoneme: "th",
    example: "think",
    how: "Put your tongue tip between your teeth — you should see it in a mirror — and blow air over it, no voice.",
    pitfall:
      "If the tongue hides behind the teeth, it becomes /s/ — 'think' turns into 'sink'. Let it stick out; it feels exaggerated but sounds right.",
  },
  s: {
    phoneme: "s",
    example: "sink",
    how: "Bring your tongue tip close behind your upper teeth without touching, and force air down the narrow groove for a sharp hiss.",
    pitfall:
      "Keep the tongue inside the mouth — if the tip slips between the teeth, it becomes /th/.",
  },
};
