import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const url = process.env.NEON_REALTIME_URL;
  const configured = Boolean(url && process.env.NEON_REALTIME_SECRET);
  if (!url) return NextResponse.json({ configured: false, reachable: false });
  const host = (() => { try { return new URL(url).host; } catch { return "invalid"; } })();
  try {
    // NEON_REALTIME_URL is a wss:// websocket URL; fetch() only speaks http(s),
    // so probe the same host over https (any HTTP response = endpoint reachable).
    const probeUrl = url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    const res = await fetch(probeUrl, { method: "GET" });
    return NextResponse.json({ configured, reachable: true, host, httpStatus: res.status, note: "any HTTP response = realtime endpoint reachable; secret value never exposed" });
  } catch (e: any) {
    return NextResponse.json({ configured, reachable: false, host, error: String(e?.message || e).slice(0, 200) });
  }
}
