import { CONNECTIONS } from "../../connections";
import type { CheckResult } from "../types";

// Instagram Messages — Check Instagram message threads for audience follow-up
// Workflow step (in the studio engine): "inbox check". Host: graph.facebook.com.
// Honesty rule: this check does NOT fake a live call. It verifies the
// connection is registered in the Universe56 registry; live reads/writes
// for this provider are performed through the Muse connector layer
// on demand. OAuth connector — the app holds no direct REST key; calls are mediated by the Muse connector layer.
// Safety rule: status/read checks only — no sends, posts, mail or spend.
export async function check(): Promise<CheckResult> {
  const conn = CONNECTIONS.find((c) => c.id === "instagram-messages" && c.app === "studio");
  if (!conn) return { ok: false, detail: "Instagram Messages not found in registry", mode: "connector-mediated" };
  return {
    ok: true,
    mode: "connector-mediated",
    detail: "Instagram Messages registered (oauth_connector, host " + conn.host + "); step \"inbox check\"; live calls connector-mediated, no raw key held by this app",
  };
}
