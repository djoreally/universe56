import { NextResponse } from "next/server";
import { ensureAllSchemas } from "@/lib/db";
import { ensureFleetTables, seedTestProspects } from "@/lib/fleet-followup";
import { ensureStudioPodcastTables, seedPodcastShow, SEEDED_SHOW } from "@/lib/studio-podcast";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const schemas = await ensureAllSchemas();
    // Reach-only extension: fleet follow-up tables + two TEST seed prospects
    // (idempotent; no real prospect data is ever seeded).
    await ensureFleetTables();
    await seedTestProspects();
    // Studio-only extension: podcast platform tables (shows / episodes /
    // audio_tracks) + the one seeded show (idempotent; no episodes seeded).
    await ensureStudioPodcastTables();
    await seedPodcastShow();
    return NextResponse.json({
      ok: true,
      schemas,
      tablesPerSchema: ["workflow_runs", "items"],
      reachExtra: { tables: ["prospects", "sequence_steps"], seededTestProspects: true },
      studioExtra: { tables: ["shows", "episodes", "audio_tracks"], seededShow: SEEDED_SHOW.slug },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
