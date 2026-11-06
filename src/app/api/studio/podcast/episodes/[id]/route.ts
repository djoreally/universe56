import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteEpisode, getEpisode, updateEpisode } from "@/lib/studio-podcast";
export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const episodeId = parseId(id);
  if (!episodeId) return NextResponse.json({ ok: false, error: "Invalid episode ID" }, { status: 400 });
  try {
    const episode = await getEpisode(episodeId);
    if (!episode) return NextResponse.json({ ok: false, error: "Episode not found" }, { status: 404 });
    return NextResponse.json({ episode });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}

const chapterSchema = z.object({
  id: z.string(),
  timeSeconds: z.number().min(0),
  title: z.string().min(1),
  summary: z.string().optional(),
});

const transcriptSegmentSchema = z.object({
  id: z.string(),
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
  speaker: z.string().min(1),
  text: z.string().min(1),
});

const updateEpisodeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  subtitle: z.string().trim().max(300).optional(),
  summary: z.string().trim().max(4000).optional(),
  description: z.string().trim().max(4000).optional(),
  showNotesMarkdown: z.string().trim().max(15000).optional(),
  episodeNumber: z.number().int().positive().optional(),
  audioTrackId: z.number().int().positive().nullable().optional(),
  sourceTrackId: z.number().int().positive().nullable().optional(),
  chapters: z.array(chapterSchema).optional(),
  transcript: z.array(transcriptSegmentSchema).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
  status: z.enum(["draft", "published"]).optional(),
  coverImage: z.string().trim().max(300).optional(),
  durationSeconds: z.number().int().min(0).optional(),
});

// PATCH /api/studio/podcast/episodes/[id] — partial update; setting
// status "published" stamps published_at (used by the UI publish toggle).
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const episodeId = parseId(id);
  if (!episodeId) return NextResponse.json({ ok: false, error: "Invalid episode ID" }, { status: 400 });
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = updateEpisodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid episode update payload" },
        { status: 400 }
      );
    }
    const episode = await updateEpisode(episodeId, parsed.data);
    if (!episode) return NextResponse.json({ ok: false, error: "Episode not found" }, { status: 404 });
    return NextResponse.json({ episode });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const episodeId = parseId(id);
  if (!episodeId) return NextResponse.json({ ok: false, error: "Invalid episode ID" }, { status: 400 });
  try {
    const deleted = await deleteEpisode(episodeId);
    if (!deleted) return NextResponse.json({ ok: false, error: "Episode not found" }, { status: 404 });
    return NextResponse.json({ deletedId: episodeId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
