import { NextResponse } from "next/server";
import { CONNECTIONS, EXPECTED_CONNECTION_COUNT } from "@/lib/connections";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ count: CONNECTIONS.length, expected: EXPECTED_CONNECTION_COUNT, countOk: CONNECTIONS.length === EXPECTED_CONNECTION_COUNT, connections: CONNECTIONS });
}
