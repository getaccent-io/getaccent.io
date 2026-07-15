export interface Passage {
  id: string;
  title: string;
  /** Rough reading time, shown to the user before they start. */
  approxSeconds: number;
  text: string;
}

// The Rainbow Passage (Fairbanks, 1960) — the standard diagnostic paragraph
// in speech research: it covers nearly every English phoneme, consonant
// clusters, and varied stress patterns in ~30 seconds of reading.
export const RAINBOW_PASSAGE: Passage = {
  id: "rainbow-1",
  title: "The Rainbow Passage",
  approxSeconds: 30,
  text:
    "When the sunlight strikes raindrops in the air, they act as a prism and form a rainbow. " +
    "The rainbow is a division of white light into many beautiful colors. " +
    "These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon. " +
    "There is, according to legend, a boiling pot of gold at one end. " +
    "People look, but no one ever finds it.",
};

export const PASSAGES: Passage[] = [RAINBOW_PASSAGE];
