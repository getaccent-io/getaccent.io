import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import type { AzureAssessmentResult, AzureWord } from "@/types/assessment";

export function azureConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

// Locate the data chunk inside a RIFF/WAVE buffer and validate the format the
// client is supposed to send (16 kHz, 16-bit, mono PCM).
function extractPcm(wav: Buffer): Buffer {
  if (wav.length < 44 || wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Expected a WAV file");
  }
  let offset = 12;
  let pcm: Buffer | null = null;
  while (offset + 8 <= wav.length) {
    const chunkId = wav.toString("ascii", offset, offset + 4);
    const chunkSize = wav.readUInt32LE(offset + 4);
    if (chunkId === "fmt ") {
      const sampleRate = wav.readUInt32LE(offset + 12);
      const channels = wav.readUInt16LE(offset + 10);
      const bits = wav.readUInt16LE(offset + 22);
      if (sampleRate !== 16000 || channels !== 1 || bits !== 16) {
        throw new Error(`Expected 16kHz 16-bit mono WAV, got ${sampleRate}Hz ${bits}-bit ${channels}ch`);
      }
    } else if (chunkId === "data") {
      pcm = wav.subarray(offset + 8, offset + 8 + chunkSize);
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  if (!pcm) throw new Error("WAV file has no data chunk");
  return pcm;
}

interface SegmentScores {
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody?: number;
  pron: number;
  words: AzureWord[];
}

/**
 * Runs Azure Pronunciation Assessment on a 16 kHz mono WAV buffer against the
 * reference text. Uses continuous recognition so paragraph-length audio
 * (beyond the 60s short-audio limit) works; per-segment results are merged
 * with word-count weighting.
 */
export function assessPronunciation(
  wav: Buffer,
  referenceText: string,
): Promise<AzureAssessmentResult> {
  const pcm = extractPcm(wav);

  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY!,
    process.env.AZURE_SPEECH_REGION!,
  );
  speechConfig.speechRecognitionLanguage = "en-US";

  const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  const pushStream = sdk.AudioInputStream.createPushStream(format);
  // Copy into a fresh ArrayBuffer — Buffer may be backed by a shared pool.
  const pcmCopy = new Uint8Array(pcm.byteLength);
  pcmCopy.set(pcm);
  pushStream.write(pcmCopy.buffer);
  pushStream.close();

  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  const paConfig = new sdk.PronunciationAssessmentConfig(
    referenceText,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Phoneme,
    /* enableMiscue */ true,
  );
  paConfig.enableProsodyAssessment = true;

  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  paConfig.applyTo(recognizer);

  const segments: SegmentScores[] = [];
  let recognizedText = "";

  return new Promise<AzureAssessmentResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      recognizer.stopContinuousRecognitionAsync(() => recognizer.close());
      reject(new Error("Azure assessment timed out"));
    }, 55_000);

    const finish = () => {
      clearTimeout(timeout);
      recognizer.close();
      if (segments.length === 0) {
        reject(new Error("Azure returned no recognition results — was the audio silent?"));
        return;
      }
      resolve(mergeSegments(segments, recognizedText));
    };

    recognizer.recognized = (_s, e) => {
      if (e.result.reason !== sdk.ResultReason.RecognizedSpeech) return;
      const raw = e.result.properties.getProperty(
        sdk.PropertyId.SpeechServiceResponse_JsonResult,
      );
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const nbest = parsed.NBest?.[0];
        const pa = nbest?.PronunciationAssessment;
        if (!nbest || !pa) return;
        recognizedText += (recognizedText ? " " : "") + (parsed.DisplayText ?? "");
        segments.push({
          accuracy: pa.AccuracyScore,
          fluency: pa.FluencyScore,
          completeness: pa.CompletenessScore,
          prosody: pa.ProsodyScore,
          pron: pa.PronScore,
          words: nbest.Words ?? [],
        });
      } catch {
        // ignore unparseable segments
      }
    };

    recognizer.canceled = (_s, e) => {
      if (e.reason === sdk.CancellationReason.Error) {
        clearTimeout(timeout);
        recognizer.close();
        reject(new Error(`Azure canceled: ${e.errorDetails}`));
      }
    };

    recognizer.sessionStopped = () => {
      recognizer.stopContinuousRecognitionAsync(finish, (err) => {
        clearTimeout(timeout);
        recognizer.close();
        reject(new Error(err));
      });
    };

    recognizer.startContinuousRecognitionAsync(undefined, (err) => {
      clearTimeout(timeout);
      recognizer.close();
      reject(new Error(err));
    });
  });
}

function mergeSegments(segments: SegmentScores[], recognizedText: string): AzureAssessmentResult {
  const weights = segments.map((s) => Math.max(1, s.words.length));
  const wavg = (pick: (s: SegmentScores) => number | undefined) => {
    let sum = 0;
    let w = 0;
    segments.forEach((s, i) => {
      const v = pick(s);
      if (v !== undefined) {
        sum += v * weights[i];
        w += weights[i];
      }
    });
    return w > 0 ? sum / w : 0;
  };

  const prosodyPresent = segments.some((s) => s.prosody !== undefined);
  return {
    RecognizedText: recognizedText,
    PronunciationAssessment: {
      AccuracyScore: wavg((s) => s.accuracy),
      FluencyScore: wavg((s) => s.fluency),
      CompletenessScore: wavg((s) => s.completeness),
      ProsodyScore: prosodyPresent ? wavg((s) => s.prosody) : undefined,
      PronScore: wavg((s) => s.pron),
    },
    Words: segments.flatMap((s) => s.words),
  };
}
