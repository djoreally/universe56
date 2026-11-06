import { NextResponse } from "next/server";
import { runFleetFollowup, prepareFleetFollowupBatch, getProspectSteps } from "@/lib/fleet-followup";
export const dynamic = "force-dynamic";

// POST /api/reach/fleet-followup — prepare a fleet follow-up sequence.
// Body: { prospectId: N } for one prospect, or { batch: true, limit?: N }
// for every status='new' prospect up to limit.
// PREPARE MODE: this composes and logs message copy only. Nothing is sent.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body && body.batch) {
      const limit = body.limit != null ? Number(body.limit) : 20;
      return NextResponse.json(await prepareFleetFollowupBatch(Number.isFinite(limit) ? limit : 20));
    }
    const prospectId = Number(body?.prospectId);
    if (!Number.isFinite(prospectId) || prospectId <= 0) {
      return NextResponse.json(
        { ok: false, error: "provide { prospectId } or { batch: true, limit }" },
        { status: 400 }
      );
    }
    return NextResponse.json(await runFleetFollowup(prospectId));
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: msg.slice(0, 300) }, { status });
  }
}

// GET /api/reach/fleet-followup?prospectId=N — the prospect's composed step
// timeline (email / SMS / voice script / postcard / social, in order).
export async function GET(req: Request) {
  try {
    const raw = new URL(req.url).searchParams.get("prospectId");
    const prospectId = Number(raw);
    if (!raw || !Number.isFinite(prospectId) || prospectId <= 0) {
      return NextResponse.json({ ok: false, error: "prospectId query parameter is required" }, { status: 400 });
    }
    const result = await getProspectSteps(prospectId);
    if (!result) return NextResponse.json({ ok: false, error: `prospect ${prospectId} not found` }, { status: 404 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
