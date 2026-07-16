// Subset of the Azure Pronunciation Assessment detailed JSON (NBest[0])
// that the app consumes. Docs: https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment

export interface AzurePhoneme {
  Phoneme: string;
  PronunciationAssessment?: {
    AccuracyScore?: number;
  };
}

export interface AzureSyllable {
  Syllable: string;
  Grapheme?: string;
  PronunciationAssessment?: {
    AccuracyScore?: number;
  };
}

export type AzureWordErrorType =
  | "None"
  | "Omission"
  | "Insertion"
  | "Mispronunciation"
  | "UnexpectedBreak"
  | "MissingBreak"
  | "Monotone";

export interface AzureWord {
  Word: string;
  Offset?: number;
  Duration?: number;
  PronunciationAssessment?: {
    AccuracyScore?: number;
    ErrorType?: AzureWordErrorType;
    Feedback?: {
      Prosody?: {
        Break?: {
          ErrorTypes?: string[];
          BreakLength?: number;
        };
        Intonation?: {
          ErrorTypes?: string[];
        };
      };
    };
  };
  Syllables?: AzureSyllable[];
  Phonemes?: AzurePhoneme[];
}

export interface AzureAssessmentResult {
  RecognizedText: string;
  PronunciationAssessment: {
    AccuracyScore: number;
    FluencyScore: number;
    CompletenessScore: number;
    PronScore: number;
    ProsodyScore?: number;
  };
  Words: AzureWord[];
}

// ---------------------------------------------------------------------------
// Derived error profile — the app's own diagnosis, computed from the Azure
// JSON in src/lib/scoring. Phase 1 covers errors 1–3 of the taxonomy.
// ---------------------------------------------------------------------------

export interface PhonemeIssue {
  phoneme: string;
  avgAccuracy: number;
  occurrences: number;
  exampleWords: string[];
  /** Sound that Korean speakers typically struggle with (r/l, th, f/v, z...). */
  koreanTypical: boolean;
}

export interface SyllableStructureIssue {
  word: string;
  kind: "final-consonant" | "cluster";
  detail: string;
  accuracy: number;
  /** The weak phoneme(s) behind this issue — lets recommendations map it to a drill track. */
  phonemes: string[];
}

export interface WordStressIssue {
  word: string;
  weakSyllables: string[];
  accuracy: number;
}

export type ErrorFinding =
  | {
      id: "phoneme-production";
      label: string;
      detected: boolean;
      severity: number;
      summary: string;
      phonemes: PhonemeIssue[];
    }
  | {
      id: "syllable-structure";
      label: string;
      detected: boolean;
      severity: number;
      summary: string;
      issues: SyllableStructureIssue[];
    }
  | {
      id: "word-stress";
      label: string;
      detected: boolean;
      severity: number;
      summary: string;
      words: WordStressIssue[];
      monotone: boolean;
    };

export interface WordResult {
  word: string;
  accuracy: number | null;
  errorType: AzureWordErrorType;
  phonemes: { phoneme: string; accuracy: number | null }[];
}

/** FIND → FIX: a drill track the profile says to train, with the evidence. */
export interface DrillRecommendation {
  trackId: string;
  trackLabel: string;
  /** Weak sounds that mapped to this track. */
  phonemes: string[];
  /** Weighted average accuracy of those sounds — lower means drill this first. */
  avgAccuracy: number;
  exampleWords: string[];
  /** Human-readable evidence, e.g. "/r/ averaged 58 · 2 weak cluster spots". */
  reason: string;
}

export interface ErrorProfile {
  overall: {
    pronScore: number;
    accuracy: number;
    fluency: number;
    completeness: number;
    prosody: number | null;
  };
  findings: ErrorFinding[];
  /** Drill tracks to train, weakest sound first. Empty when nothing maps. */
  recommendations: DrillRecommendation[];
  words: WordResult[];
}

export interface AssessmentResponse {
  mode: "azure" | "mock";
  azure: AzureAssessmentResult;
  profile: ErrorProfile;
}
