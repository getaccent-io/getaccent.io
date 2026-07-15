import { NextResponse } from "next/server";
import { assessPronunciation, azureConfigured } from "@/lib/azure/pronunciation";
import { buildErrorProfile } from "@/lib/scoring/errorProfile";
import { mockAzureAssessment } from "@/mocks/azureAssessment";
import type { AssessmentResponse } from "@/types/assessment";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // ~6 min of 16kHz mono PCM

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
    const azure =
      mode === "azure"
        ? await assessPronunciation(Buffer.from(await audio.arrayBuffer()), referenceText)
        : mockAzureAssessment(referenceText);

    const body: AssessmentResponse = { mode, azure, profile: buildErrorProfile(azure) };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Assessment failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
