import { NextResponse } from "next/server";
import { ensureAllSchemas } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const schemas = await ensureAllSchemas();
    return NextResponse.json({ ok: true, schemas, tablesPerSchema: ["workflow_runs", "items"] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
