import { NextResponse } from "next/server";
import { z } from "zod";
import { createTrack, listTracks } from "@/lib/studio-podcast";
export const dynamic = "force-dynamic";

// GET /api/studio/podcast/audio-tracks — extracted tracks, newest first.
// Response rows never contain audio bytes; hasCustomAudio flags whether the
// real WAV is in Object Storage.
export async function GET() {
  try {
    return NextResponse.json({ tracks: await listTracks() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}

const createAudioTrackSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  sourceType: z.enum(["upload", "url", "sample"]).default("upload"),
  sourceVideoName: z.string().trim().min(1).max(200).optional(),
  sourceVideoUrl: z.string().trim().max(500).nullable().optional(),
  sourcePlatform: z.string().trim().max(60).optional(),
  format: z.enum(["WAV", "MP3", "AAC"]).default("WAV"),
  sampleRate: z.number().int().min(8000).max(192000).optional(),
  bitrateKbps: z.number().int().min(64).max(4608).optional(),
  channels: z.number().int().min(1).max(2).optional(),
  durationSeconds: z.number().int().min(1).max(14400).optional(),
  fileSizeBytes: z.number().int().min(100).optional(),
  lufsLoudness: z.number().min(-40).max(0).optional(),
  noiseReduction: z.boolean().default(true),
  voiceIsolation: z.boolean().default(true),
  speakerLabel: z.string().trim().min(1).max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  waveformPeaks: z.array(z.number().min(0).max(1)).min(8).max(256).optional(),
  // Extracted WAV from the browser extractor; uploaded server-side to Neon
  // Object Storage (studio/ prefix). Never stored in Postgres.
  audioBase64: z.string().max(3_200_000).nullable().optional(),
});

// POST /api/studio/podcast/audio-tracks — save an extracted track. When
// audioBase64 is present the WAV goes to Object Storage; if that upload
// fails, the metadata is still saved (audio_url null) and storageError
// is returned so the UI can say so honestly.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createAudioTrackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid audio extraction payload" },
        { status: 400 }
      );
    }
    const { track, storageError } = await createTrack(parsed.data);
    return NextResponse.json({ track, ...(storageError ? { storageError } : {}) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
