import { CONNECTIONS } from "../../connections";
import type { CheckResult } from "../types";

// Spotify — Check profile/playlists for audio used in content
// Workflow step (in the studio engine): "audio check". Host: api.spotify.com.
// Honesty rule: this check does NOT fake a live call. It verifies the
// connection is registered in the Universe56 registry; live reads/writes
// for this provider are performed through the Muse connector layer
// on demand. OAuth connector — the app holds no direct REST key; calls are mediated by the Muse connector layer.
// Safety rule: status/read checks only — no sends, posts, mail or spend.
export async function check(): Promise<CheckResult> {
  const conn = CONNECTIONS.find((c) => c.id === "spotify" && c.app === "studio");
  if (!conn) return { ok: false, detail: "Spotify not found in registry", mode: "connector-mediated" };
  return {
    ok: true,
    mode: "connector-mediated",
    detail: "Spotify registered (oauth_connector, host " + conn.host + "); step \"audio check\"; live calls connector-mediated, no raw key held by this app",
  };
}
