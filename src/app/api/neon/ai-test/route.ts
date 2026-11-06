import { NextResponse } from "next/server";
import { aiComplete } from "@/lib/ai";
export const dynamic = "force-dynamic";
export async function GET() {
  const r = await aiComplete("Reply with the word READY");
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
