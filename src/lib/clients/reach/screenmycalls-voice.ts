import { CONNECTIONS } from "../../connections";
import type { CheckResult } from "../types";

// ScreenMyCalls Voice — Health-check the outbound voice server (never places a call from here)
// Workflow step (in the reach engine): "sms/voice channel check". Host: voice.screenmycalls.app.
// Honesty rule: this check does NOT fake a live call. It verifies the
// connection is registered in the Universe56 registry; live reads/writes
// for this provider are performed through the Muse connector layer
// on demand. Custom API connection — the raw API key lives only in the Muse Secure Vault; the app holds no key.
// Safety rule: status/read checks only — no sends, posts, mail or spend.
export async function check(): Promise<CheckResult> {
  const conn = CONNECTIONS.find((c) => c.id === "screenmycalls-voice" && c.app === "reach");
  if (!conn) return { ok: false, detail: "ScreenMyCalls Voice not found in registry", mode: "connector-mediated" };
  return {
    ok: true,
    mode: "connector-mediated",
    detail: "ScreenMyCalls Voice registered (custom_api_key, host " + conn.host + "); step \"sms/voice channel check\"; live calls connector-mediated, no raw key held by this app",
  };
}
