import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const base = process.env.NEON_AUTH_BASE_URL;
  if (!base) return NextResponse.json({ configured: false, reachable: false });
  const host = (() => { try { return new URL(base).host; } catch { return "invalid"; } })();
  // Harmless probe: sign-in with invalid credentials must return a structured 4xx,
  // which proves the Managed Auth service is up without leaking anything.
  try {
    const res = await fetch(`${base}/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "healthcheck@invalid.example", password: "not-a-real-password" }),
    });
    return NextResponse.json({ configured: true, reachable: res.status >= 400 && res.status < 500, host, probeHttpStatus: res.status, probe: "POST /sign-in/email with invalid creds (structured 4xx expected)" });
  } catch (e: any) {
    return NextResponse.json({ configured: true, reachable: false, host, error: String(e?.message || e).slice(0, 200) });
  }
}
