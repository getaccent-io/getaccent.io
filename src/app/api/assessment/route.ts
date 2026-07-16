import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ACCENT_LOCALE, isAccent, type Accent } from "@/lib/accent";
import { assessPronunciation, azureConfigured } from "@/lib/azure/pronunciation";
import { buildErrorProfile } from "@/lib/scoring/errorProfile";
import { nameUkPhonemes } from "@/lib/scoring/ukPhonemes";
import { mockAzureAssessment } from "@/mocks/azureAssessment";
import type {
  AssessmentResponse,
  AzureAssessmentResult,
  ErrorProfile,
} from "@/types/assessment";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // ~6 min of 16kHz mono PCM

// In dev, every real-Azure assessment is saved to notes/calibration/
// (gitignored) so recordings accumulate into the corpus for tuning the
// errorProfile thresholds. Mock results carry no calibration signal.
async function captureForCalibration(
  audio: Buffer,
  referenceText: string,
  accent: Accent,
  azure: AzureAssessmentResult,
  profile: ErrorProfile,
): Promise<void> {
  const dir = path.join(
    process.cwd(),
    "notes",
    "calibration",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  await mkdir(dir, { recursive: true });
  await Promise.all([
    writeFile(path.join(dir, "recording.wav"), audio),
    writeFile(path.join(dir, "azure.json"), JSON.stringify(azure, null, 2)),
    writeFile(path.join(dir, "profile.json"), JSON.stringify(profile, null, 2)),
    writeFile(
      path.join(dir, "meta.json"),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          referenceText,
          accent,
          locale: ACCENT_LOCALE[accent],
          audioBytes: audio.length,
        },
        null,
        2,
      ),
    ),
  ]);
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const referenceText = form.get("referenceText");
  const audio = form.get("audio");
  if (typeof referenceText !== "string" || !referenceText.trim()) {
    return NextResponse.json({ error: "Missing referenceText" }, { status: 400 });
  }
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio too large" }, { status: 413 });
  }
  // Target accent: sets the Azure locale, so scores judge against the accent
  // the user is actually aiming for. Absent/unknown values mean American.
  const accentField = form.get("accent");
  const accent: Accent = isAccent(accentField) ? accentField : "us";

  try {
    // Without Azure credentials the endpoint serves a deterministic mock so
    // the whole flow (and the UI) can be developed and demoed offline.
    const mode = azureConfigured() ? "azure" : "mock";
    let azure: AzureAssessmentResult;
    let audioBuffer: Buffer | null = null;
    if (mode === "azure") {
      audioBuffer = Buffer.from(await audio.arrayBuffer());
      azure = await assessPronunciation(audioBuffer, referenceText, ACCENT_LOCALE[accent]);
      // en-GB scores phonemes without naming them; re-attach known names so
      // findings and drill links work for UK too.
      if (accent === "uk") azure = nameUkPhonemes(azure);
    } else {
      azure = mockAzureAssessment(referenceText);
    }
    const profile = buildErrorProfile(azure);

    // Only bare passage reads (the assess flow sends no source) feed the
    // calibration corpus — drill words and shadowing sentences would
    // pollute it.
    const hasSource = form.get("source") !== null;
    if (audioBuffer && !hasSource && process.env.NODE_ENV === "development") {
      try {
        await captureForCalibration(audioBuffer, referenceText, accent, azure, profile);
      } catch (err) {
        console.warn("Calibration capture failed:", err);
      }
    }

    const body: AssessmentResponse = { mode, azure, profile };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Assessment failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
