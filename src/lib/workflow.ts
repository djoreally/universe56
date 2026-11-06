import { connectionsForApp, type AppId } from "./connections";
import { CLIENT_CHECKS } from "./clients";
import { aiComplete } from "./ai";
import { db, ensureSchema } from "./db";

export interface StepResult { step: string; connectionId?: string; ok: boolean; detail: string; }

const AI_PROMPTS: Record<AppId, string> = {
  reach: "In one short sentence, draft a friendly first-touch outreach line for a local fleet manager about mobile oil change service. No placeholders.",
  studio: "In one short sentence, give a content brief headline idea for a mobile oil change business social post. No placeholders.",
  ops: "In one short sentence, summarize what a prospect-research enrichment should verify first about a local fleet company. No placeholders.",
};

export async function runWorkflow(app: AppId) {
  await ensureSchema(app);
  const startedAt = new Date();
  const steps: StepResult[] = [{ step: app === "reach" ? "lead intake" : app === "studio" ? "content brief" : "workflow start", ok: true, detail: `${app} workflow started; ${connectionsForApp(app).length} connections queued` }];
  for (const conn of connectionsForApp(app)) {
    const check = CLIENT_CHECKS[conn.id];
    if (!check) { steps.push({ step: conn.step, connectionId: conn.id, ok: false, detail: "no client module registered" }); continue; }
    try {
      const r = await check();
      steps.push({ step: conn.step, connectionId: conn.id, ok: r.ok, detail: r.detail });
    } catch (e: any) {
      steps.push({ step: conn.step, connectionId: conn.id, ok: false, detail: `check threw: ${e?.message || "error"}` });
    }
  }
  const ai = await aiComplete(AI_PROMPTS[app]);
  steps.push({ step: app === "ops" ? "ai enrichment" : "ai draft (Neon AI Gateway)", ok: ai.ok, detail: ai.ok ? `model ${ai.model}: ${ai.reply}` : ai.detail });
  const status = steps.every((s) => s.ok) ? "completed" : "completed_with_warnings";
  const sql = db();
  const rows: any[] = await sql.query(
    `INSERT INTO ${app}.workflow_runs (started_at, finished_at, steps, status) VALUES ($1, now(), $2::jsonb, $3) RETURNING id, started_at, finished_at, steps, status`,
    [startedAt.toISOString(), JSON.stringify(steps), status]
  );
  return rows[0];
}

export async function listRuns(app: AppId, limit = 10) {
  await ensureSchema(app);
  const sql = db();
  return sql.query(`SELECT id, started_at, finished_at, steps, status FROM ${app}.workflow_runs ORDER BY id DESC LIMIT $1`, [limit]);
}
