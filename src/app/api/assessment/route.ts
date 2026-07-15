import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { assessPronunciation, azureConfigured } from "@/lib/azure/pronunciation";
import { buildErrorProfile } from "@/lib/scoring/errorProfile";
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
        { capturedAt: new Date().toISOString(), referenceText, audioBytes: audio.length },
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

  try {
    // Without Azure credentials the endpoint serves a deterministic mock so
    // the whole flow (and the UI) can be developed and demoed offline.
    const mode = azureConfigured() ? "azure" : "mock";
    let azure: AzureAssessmentResult;
    let audioBuffer: Buffer | null = null;
    if (mode === "azure") {
      audioBuffer = Buffer.from(await audio.arrayBuffer());
      azure = await assessPronunciation(audioBuffer, referenceText);
    } else {
      azure = mockAzureAssessment(referenceText);
    }
    const profile = buildErrorProfile(azure);

    // Speaking-drill attempts are single words — keep them out of the
    // calibration corpus, which is for passage reads.
    const isDrill = form.get("source") === "drill";
    if (audioBuffer && !isDrill && process.env.NODE_ENV === "development") {
      try {
        await captureForCalibration(audioBuffer, referenceText, azure, profile);
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
