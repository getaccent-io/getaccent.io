// Minimal-pair bank for HVPT (high-variability phonetic training) listening
// drills. Each track targets one contrast that Korean speakers typically
// can't hear; each pair differs only in that contrast. `phonemes` uses the
// same SAPI symbols the Azure assessment returns, so an error profile can be
// mapped straight to a track.

export interface MinimalPairTrack {
  id: string;
  label: string;
  phonemes: string[];
  description: string;
  /** [wordWithFirstPhoneme, wordWithSecondPhoneme] */
  pairs: [string, string][];
}

export const HVPT_TRACKS: MinimalPairTrack[] = [
  {
    id: "r-l",
    label: "R vs L",
    phonemes: ["r", "l"],
    description:
      "Korean has one liquid sound where English has two. If you can't hear the difference, you can't say it.",
    pairs: [
      ["right", "light"],
      ["read", "lead"],
      ["rock", "lock"],
      ["road", "load"],
      ["pray", "play"],
      ["crowd", "cloud"],
      ["arrive", "alive"],
      ["correct", "collect"],
    ],
  },
  {
    id: "f-p",
    label: "F vs P",
    phonemes: ["f", "p"],
    description:
      "Korean has no /f/, so it usually becomes /p/ — 'coffee' turns into 'copy'.",
    pairs: [
      ["fan", "pan"],
      ["fine", "pine"],
      ["fork", "pork"],
      ["fair", "pair"],
      ["fool", "pool"],
      ["coffee", "copy"],
      ["fast", "past"],
      ["fill", "pill"],
    ],
  },
  {
    id: "v-b",
    label: "V vs B",
    phonemes: ["v", "b"],
    description: "Korean has no /v/, so 'very' tends to come out as 'berry'.",
    pairs: [
      ["vest", "best"],
      ["van", "ban"],
      ["very", "berry"],
      ["vote", "boat"],
      ["vase", "base"],
      ["vow", "bow"],
      ["curve", "curb"],
      ["marvel", "marble"],
    ],
  },
  {
    id: "th-s",
    label: "TH vs S",
    phonemes: ["th", "s"],
    description:
      "The English 'th' doesn't exist in Korean and usually surfaces as /s/ — 'think' becomes 'sink'.",
    pairs: [
      ["think", "sink"],
      ["thank", "sank"],
      ["thick", "sick"],
      ["mouth", "mouse"],
      ["path", "pass"],
      ["faith", "face"],
      ["theme", "seem"],
      ["worth", "worse"],
    ],
  },
];

/** Maps a weak phoneme from the error profile to the drill track that trains it. */
export const PHONEME_TO_TRACK: Record<string, string> = {
  r: "r-l",
  l: "r-l",
  f: "f-p",
  v: "v-b",
  th: "th-s",
  dh: "th-s",
};

export function getTrack(id: string): MinimalPairTrack | undefined {
  return HVPT_TRACKS.find((t) => t.id === id);
}
