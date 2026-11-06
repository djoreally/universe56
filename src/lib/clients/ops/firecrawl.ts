import { CONNECTIONS } from "../../connections";
import type { CheckResult } from "../types";

// Firecrawl — Search the web for prospect research
// Workflow step (in the ops engine): "prospect research". Host: api.firecrawl.dev.
// Honesty rule: this check does NOT fake a live call. It verifies the
// connection is registered in the Universe56 registry; live reads/writes
// for this provider are performed through the Muse connector layer
// on demand. Custom API connection — the raw API key lives only in the Muse Secure Vault; the app holds no key.
// Safety rule: status/read checks only — no sends, posts, mail or spend.
export async function check(): Promise<CheckResult> {
  const conn = CONNECTIONS.find((c) => c.id === "firecrawl" && c.app === "ops");
  if (!conn) return { ok: false, detail: "Firecrawl not found in registry", mode: "connector-mediated" };
  return {
    ok: true,
    mode: "connector-mediated",
    detail: "Firecrawl registered (custom_api_key, host " + conn.host + "); step \"prospect research\"; live calls connector-mediated, no raw key held by this app",
  };
}
