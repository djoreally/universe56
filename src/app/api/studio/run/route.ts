import { NextResponse } from "next/server";
import { runWorkflow } from "@/lib/workflow";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(await runWorkflow("studio")); }
  catch (e: any) { return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 }); }
}
export async function POST() { return GET(); }
