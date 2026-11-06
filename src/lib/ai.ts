export interface AiResult { ok: boolean; model?: string; reply?: string; httpStatus?: number; detail: string; }

export async function discoverModel(): Promise<{ model?: string; httpStatus?: number; detail: string }> {
  const base = process.env.NEON_AI_GATEWAY_BASE_URL;
  const token = process.env.NEON_AI_GATEWAY_TOKEN;
  if (!base || !token) return { detail: "NEON_AI_GATEWAY_BASE_URL/TOKEN not configured" };
  try {
    const res = await fetch(`${base}/v1/models`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { httpStatus: res.status, detail: `GET /v1/models returned HTTP ${res.status}` };
    const body: any = await res.json().catch(() => ({}));
    const list: any[] = Array.isArray(body?.data) ? body.data : [];
    const enabled = list.filter((m) => m && (m.enabled !== false));
    const chat = enabled.find((m) => {
      const s = JSON.stringify(m).toLowerCase();
      return !s.includes("embed") && !s.includes("rerank");
    }) || enabled[0];
    if (!chat?.id) {
      const reasons = list.filter((m) => !m || m.enabled === false).map((m) => m?.unavailable_reason).filter(Boolean);
      const reason = reasons.length ? String(reasons[0]) : "none_enabled";
      return { httpStatus: res.status, detail: `GET /v1/models returned ${list.length} models, 0 enabled (unavailable_reason: ${reason})` };
    }
    return { model: String(chat.id), httpStatus: res.status, detail: `discovered ${enabled.length} enabled models` };
  } catch (e: any) {
    return { detail: `models fetch failed: ${e?.message || "network error"}` };
  }
}

export async function aiComplete(prompt: string): Promise<AiResult> {
  const base = process.env.NEON_AI_GATEWAY_BASE_URL;
  const token = process.env.NEON_AI_GATEWAY_TOKEN;
  if (!base || !token) return { ok: false, detail: "AI Gateway env not configured" };
  const d = await discoverModel();
  if (!d.model) return { ok: false, httpStatus: d.httpStatus, detail: d.detail };
  try {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: d.model, messages: [{ role: "user", content: prompt }], max_tokens: 60 }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, model: d.model, httpStatus: res.status, detail: `chat/completions HTTP ${res.status}: ${body?.error?.message || body?.message || "error"}`.slice(0, 300) };
    const reply = body?.choices?.[0]?.message?.content ?? "";
    return { ok: true, model: d.model, reply: String(reply).trim(), httpStatus: res.status, detail: "completion ok" };
  } catch (e: any) {
    return { ok: false, model: d.model, detail: `chat/completions fetch failed: ${e?.message || "network error"}` };
  }
}
