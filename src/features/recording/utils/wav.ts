// Browser-side audio conversion: whatever container MediaRecorder produced
// (webm/opus in Chrome, mp4/aac in Safari) → 16 kHz mono 16-bit PCM WAV,
// which is what Azure Speech expects. Doing this client-side keeps the
// server free of ffmpeg.

const TARGET_RATE = 16000;

export async function blobToWav16kMono(blob: Blob): Promise<Blob> {
  const encoded = await blob.arrayBuffer();

  // decodeAudioData needs a realtime context; close it as soon as we're done.
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(encoded);
  } finally {
    void decodeCtx.close();
  }

  const frames = Math.ceil(decoded.duration * TARGET_RATE);
  if (frames === 0) throw new Error("Recording is empty");

  // OfflineAudioContext at the target rate does the resample and mixdown.
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  return encodeWav(rendered.getChannelData(0), TARGET_RATE);
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/** 1s of silence — dev-only stand-in for a real recording in mock mode. */
export function silentWav(): Blob {
  return encodeWav(new Float32Array(TARGET_RATE), TARGET_RATE);
}
