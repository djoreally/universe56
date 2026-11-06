import { CONNECTIONS } from "../../connections";
import type { CheckResult } from "../types";

// Postforme (Post For Me) — List connected social accounts for outreach posting drafts
// Workflow step (in the reach engine): "social channel check". Host: api.postforme.dev.
// Honesty rule: this check does NOT fake a live call. It verifies the
// connection is registered in the Universe56 registry; live reads/writes
// for this provider are performed through the Muse connector layer
// on demand. Custom API connection — the raw API key lives only in the Muse Secure Vault; the app holds no key.
// Safety rule: status/read checks only — no sends, posts, mail or spend.
export async function check(): Promise<CheckResult> {
  const conn = CONNECTIONS.find((c) => c.id === "postforme" && c.app === "reach");
  if (!conn) return { ok: false, detail: "Postforme (Post For Me) not found in registry", mode: "connector-mediated" };
  return {
    ok: true,
    mode: "connector-mediated",
    detail: "Postforme (Post For Me) registered (custom_api_key, host " + conn.host + "); step \"social channel check\"; live calls connector-mediated, no raw key held by this app",
  };
}
