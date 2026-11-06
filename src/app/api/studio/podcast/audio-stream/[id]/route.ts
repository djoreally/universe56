import { getStudioAudio, getTrackRow } from "@/lib/studio-podcast";
import { synthesizeStudioWavBuffer } from "@/lib/audio-synthesis";
export const dynamic = "force-dynamic";

// GET /api/studio/podcast/audio-stream/[id] — serves a track's audio.
//   1. If the track has stored audio (storage_key), the WAV is read from
//      Neon Object Storage. A failed read returns 502 — never a silent
//      substitute.
//   2. Metadata-only tracks (no uploaded bytes) fall back to the source
//      app's behavior: a synthesized WAV preview generated from the
//      track's waveform peaks.
// Supports Range requests (player scrubbing) and ?download=1.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const trackId = Number(id);
  if (!Number.isInteger(trackId) || trackId <= 0) {
    return new Response("Invalid track ID", { status: 400 });
  }

  const row = await getTrackRow(trackId);
  if (!row) {
    return new Response("Audio track not found", { status: 404 });
  }

  let wavBuffer: Buffer;
  if (row.storage_key) {
    try {
      wavBuffer = await getStudioAudio(row.storage_key);
    } catch (e: any) {
      return new Response(
        `Stored audio could not be read: ${String(e?.message || e).slice(0, 200)}`,
        { status: 502 }
      );
    }
  } else {
    wavBuffer = synthesizeStudioWavBuffer({
      seed: row.id,
      durationSeconds: row.duration_seconds,
      waveformPeaks: Array.isArray(row.waveform_peaks) ? row.waveform_peaks : [],
      voiceIsolation: row.voice_isolation,
    });
  }

  const url = new URL(request.url);
  const isDownload = url.searchParams.get("download") === "1";
  const safeFilename = `${String(row.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}.wav`;

  const totalLength = wavBuffer.byteLength;
  const rangeHeader = request.headers.get("range");

  if (rangeHeader && !isDownload) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2]
        ? Math.min(totalLength - 1, parseInt(match[2], 10))
        : totalLength - 1;
      if (start >= 0 && start <= end && end < totalLength) {
        const chunk = wavBuffer.subarray(start, end + 1);
        return new Response(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "Content-Type": "audio/wav",
            "Content-Range": `bytes ${start}-${end}/${totalLength}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunk.byteLength),
            "Cache-Control": "private, max-age=300",
          },
        });
      }
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "audio/wav",
    "Content-Length": String(totalLength),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
  };
  if (isDownload) {
    headers["Content-Disposition"] = `attachment; filename="${safeFilename}"`;
  }

  return new Response(new Uint8Array(wavBuffer), { status: 200, headers });
}
