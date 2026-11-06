import { NextResponse } from "next/server";
import { z } from "zod";
import { createEpisode, listEpisodes } from "@/lib/studio-podcast";
export const dynamic = "force-dynamic";

// GET /api/studio/podcast/episodes — all episodes, newest number first.
export async function GET() {
  try {
    return NextResponse.json({ episodes: await listEpisodes() });
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

const createEpisodeSchema = z.object({
  // Topic-driven generation: POST { action: "generate", topic } -> draft episode.
  // The generator is deterministic template logic — no external AI call.
  action: z.literal("generate").optional(),
  topic: z.string().trim().min(1).max(300).optional(),
  sourceTrackId: z.number().int().positive().nullable().optional(),
  audioTrackId: z.number().int().positive().nullable().optional(),
  customTitle: z.string().trim().max(200).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  subtitle: z.string().trim().max(300).optional(),
  summary: z.string().trim().max(4000).optional(),
  description: z.string().trim().max(4000).optional(),
  showNotesMarkdown: z.string().trim().max(15000).optional(),
  episodeStyle: z
    .enum([
      "Solo Creator Deep Dive",
      "Interview & Q&A Breakdown",
      "Weekly Tech & Product Roundup",
      "Narrative Story & Lessons",
    ])
    .optional(),
  masteringPreset: z.string().trim().min(2).max(80).optional(),
  includeIntroOutro: z.boolean().optional(),
  focusNotes: z.string().trim().max(1000).optional(),
  episodeNumber: z.number().int().positive().optional(),
  status: z.enum(["draft", "published"]).optional(),
  chapters: z.array(chapterSchema).optional(),
  transcript: z.array(transcriptSegmentSchema).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
  coverImage: z.string().trim().max(300).optional(),
});

// POST /api/studio/podcast/episodes — create an episode (generator fills any
// field not supplied), or { action: "generate", topic } for a topic draft.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createEpisodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid episode payload" },
        { status: 400 }
      );
    }
    if (parsed.data.action === "generate" && !parsed.data.topic) {
      return NextResponse.json(
        { ok: false, error: "topic is required when action is 'generate'" },
        { status: 400 }
      );
    }
    const episode = await createEpisode(parsed.data);
    return NextResponse.json(
      {
        episode,
        ...(parsed.data.action === "generate"
          ? { generatedWith: "deterministic template generator (no external AI call)" }
          : {}),
      },
      { status: 201 }
    );
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: msg.slice(0, 300) }, { status });
  }
}
