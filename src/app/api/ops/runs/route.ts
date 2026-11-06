import { NextResponse } from "next/server";
import { listRuns } from "@/lib/workflow";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(await listRuns("ops")); }
  catch (e: any) { return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 }); }
}
