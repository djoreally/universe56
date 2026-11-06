import { NextResponse } from "next/server";
import { ensureAllSchemas } from "@/lib/db";
import { ensureFleetTables, seedTestProspects } from "@/lib/fleet-followup";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const schemas = await ensureAllSchemas();
    // Reach-only extension: fleet follow-up tables + two TEST seed prospects
    // (idempotent; no real prospect data is ever seeded).
    await ensureFleetTables();
    await seedTestProspects();
    return NextResponse.json({
      ok: true,
      schemas,
      tablesPerSchema: ["workflow_runs", "items"],
      reachExtra: { tables: ["prospects", "sequence_steps"], seededTestProspects: true },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
