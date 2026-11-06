import { NextResponse } from "next/server";
import { getSeededShow } from "@/lib/studio-podcast";
export const dynamic = "force-dynamic";

// GET /api/studio/podcast/show — the seeded Studio podcast show
// ("The Mobile Oil Change Podcast"). Seeding is idempotent and happens
// on read, so this works before /api/neon/init has ever been called.
export async function GET() {
  try {
    const show = await getSeededShow();
    if (!show) return NextResponse.json({ ok: false, error: "show not found" }, { status: 404 });
    return NextResponse.json({ show });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
