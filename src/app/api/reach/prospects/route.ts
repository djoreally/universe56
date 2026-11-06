import { NextResponse } from "next/server";
import { listProspects, addProspect } from "@/lib/fleet-followup";
export const dynamic = "force-dynamic";

// GET /api/reach/prospects — all prospects with per-prospect prepared-step counts.
export async function GET() {
  try {
    return NextResponse.json(await listProspects());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}

// POST /api/reach/prospects — add one prospect. Body: { company (required),
// contact_name?, email?, phone?, mailing_address?, vehicle_count?, source? }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body || !String(body.company || "").trim()) {
      return NextResponse.json({ ok: false, error: "company is required" }, { status: 400 });
    }
    const prospect = await addProspect(body);
    return NextResponse.json({ ok: true, prospect }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 400 });
  }
}
