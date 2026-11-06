import { CONNECTIONS } from "../../connections";
import type { CheckResult } from "../types";

// Plaid — Check linked accounts/balances for the money picture
// Workflow step (in the ops engine): "money check". Host: production.plaid.com.
// Honesty rule: this check does NOT fake a live call. It verifies the
// connection is registered in the Universe56 registry; live reads/writes
// for this provider are performed through the Muse connector layer
// on demand. OAuth connector — the app holds no direct REST key; calls are mediated by the Muse connector layer.
// Safety rule: status/read checks only — no sends, posts, mail or spend.
export async function check(): Promise<CheckResult> {
  const conn = CONNECTIONS.find((c) => c.id === "plaid" && c.app === "ops");
  if (!conn) return { ok: false, detail: "Plaid not found in registry", mode: "connector-mediated" };
  return {
    ok: true,
    mode: "connector-mediated",
    detail: "Plaid registered (oauth_connector, host " + conn.host + "); step \"money check\"; live calls connector-mediated, no raw key held by this app",
  };
}
