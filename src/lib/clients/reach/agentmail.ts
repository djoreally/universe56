import { CONNECTIONS } from "../../connections";
import type { CheckResult } from "../types";

// AgentMail — Read the moms@agentmail.to inbox (threads/search) for inbound leads
// Workflow step (in the reach engine): "email channel check". Host: api.agentmail.to.
// Honesty rule: this check does NOT fake a live call. It verifies the
// connection is registered in the Universe56 registry; live reads/writes
// for this provider are performed through the Muse connector layer
// on demand. Custom API connection — the raw API key lives only in the Muse Secure Vault; the app holds no key.
// Safety rule: status/read checks only — no sends, posts, mail or spend.
export async function check(): Promise<CheckResult> {
  const conn = CONNECTIONS.find((c) => c.id === "agentmail" && c.app === "reach");
  if (!conn) return { ok: false, detail: "AgentMail not found in registry", mode: "connector-mediated" };
  return {
    ok: true,
    mode: "connector-mediated",
    detail: "AgentMail registered (custom_api_key, host " + conn.host + "); step \"email channel check\"; live calls connector-mediated, no raw key held by this app",
  };
}
