import { db, ensureSchema } from "./db";

// ── MOMS Mobile Oil Change — verified fleet facts ──────────────────────────
// Copy in this file is composed ONLY from these facts. Do not invent prices,
// services, or claims beyond what is listed here.
//   Fleet pricing: $120/vehicle (1–4 vehicles), $115 (5–9), $110 (10–24),
//   25+ = custom quote. Mobil 1 is +$10/vehicle. $50 referral credit.
//   Fleets book by phone (215) 767-2125 or support@momsoilchange.com —
//   there is NO online booking for fleets.
//   Business: MOMS Mobile Oil Change, 428 Railroad Ave, Ambler, PA 19002.
//   Mobile service: we come to the customer's lot; no downtime driving to a shop.
export const MOMS = {
  business: "MOMS Mobile Oil Change",
  phone: "(215) 767-2125",
  email: "support@momsoilchange.com",
  address: "428 Railroad Ave, Ambler, PA 19002",
  referralCredit: "$50",
} as const;

export interface Tier {
  price: number | null; // null = custom quote (25+) or unknown fleet size
  label: string;
}

export function tierFor(vehicleCount: number | null | undefined): Tier {
  if (vehicleCount == null || !Number.isFinite(vehicleCount) || vehicleCount <= 0)
    return { price: null, label: "fleet pricing quoted per fleet size" };
  if (vehicleCount <= 4) return { price: 120, label: "1–4 vehicle tier" };
  if (vehicleCount <= 9) return { price: 115, label: "5–9 vehicle tier" };
  if (vehicleCount <= 24) return { price: 110, label: "10–24 vehicle tier" };
  return { price: null, label: "25+ vehicles — custom quote" };
}

// ── Reach fleet tables (idempotent DDL, reach schema only) ─────────────────
export async function ensureFleetTables(): Promise<void> {
  await ensureSchema("reach");
  const sql = db();
  await sql.query(`CREATE TABLE IF NOT EXISTS reach.prospects (
    id serial PRIMARY KEY,
    company text NOT NULL,
    contact_name text,
    email text,
    phone text,
    mailing_address text,
    vehicle_count int,
    status text NOT NULL DEFAULT 'new',
    source text,
    is_test boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await sql.query(`CREATE TABLE IF NOT EXISTS reach.sequence_steps (
    id serial PRIMARY KEY,
    prospect_id int REFERENCES reach.prospects(id),
    run_id int,
    step_order int NOT NULL,
    channel text NOT NULL,
    connection_id text NOT NULL,
    subject text,
    body text NOT NULL,
    status text NOT NULL DEFAULT 'prepared',
    detail text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await sql.query(`CREATE INDEX IF NOT EXISTS sequence_steps_prospect_idx ON reach.sequence_steps (prospect_id)`);
  // Lets a workflow_runs row carry its workflow name (health-check runs leave it null).
  await sql.query(`ALTER TABLE reach.workflow_runs ADD COLUMN IF NOT EXISTS workflow text`);
}

// ── Seed: exactly two TEST prospects, idempotent. Called only from the init
// route. No real prospect data is ever seeded. ──────────────────────────────
export async function seedTestProspects(): Promise<void> {
  await ensureFleetTables();
  const sql = db();
  await sql.query(
    `INSERT INTO reach.prospects (company, contact_name, email, phone, mailing_address, vehicle_count, source, is_test)
     SELECT $1, $2, $3, $4, $5, $6, $7, true
     WHERE NOT EXISTS (SELECT 1 FROM reach.prospects WHERE company = $1)`,
    ["TEST — Owner Test Prospect", "Tyreese Burton", "djoreally@gmail.com", "(215) 767-2125", "428 Railroad Ave, Ambler, PA 19002", 6, "seed"]
  );
  await sql.query(
    `INSERT INTO reach.prospects (company, contact_name, email, phone, mailing_address, vehicle_count, source, is_test)
     SELECT $1, $2, $3, $4, $5, $6, $7, true
     WHERE NOT EXISTS (SELECT 1 FROM reach.prospects WHERE company = $1)`,
    ["TEST — Sample Fleet Co", "Sam Sample", "test@example.com", null, null, 12, "seed"]
  );
}

// ── Step composition ────────────────────────────────────────────────────────
export interface Prospect {
  id: number;
  company: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  mailing_address: string | null;
  vehicle_count: number | null;
  status: string;
  source: string | null;
  is_test: boolean;
  created_at: string;
}

export interface StepDraft {
  step_order: number;
  channel: "email" | "sms" | "voice" | "postcard" | "social";
  connection_id: string;
  subject: string | null;
  body: string;
}

const PREPARED_DETAIL =
  "Prepared in Universe56 (prepare mode). Nothing has been sent — dispatch happens through the owner's connector tooling after his approval.";

function firstName(contact: string | null): string {
  return contact ? contact.trim().split(/\s+/)[0] : "there";
}

export function composeSteps(p: Prospect): StepDraft[] {
  const tier = tierFor(p.vehicle_count);
  const price = tier.price != null ? `$${tier.price}` : null;
  const greetName = firstName(p.contact_name);
  const fleetPhrase =
    p.vehicle_count != null ? `your ${p.vehicle_count} vehicles` : "your fleet";
  const ratePhrase =
    price != null
      ? `${price} per vehicle (${tier.label})`
      : "a custom per-vehicle quote for a fleet your size (25+ vehicles)";

  // a. Email — EngineMailer
  const emailSubject =
    price != null
      ? `Mobile oil changes for ${p.company} — we come to your lot at ${price}/vehicle`
      : `Mobile oil changes for ${p.company} — we come to your lot`;
  const emailBody = [
    `Hi ${greetName},`,
    ``,
    `I'm reaching out from ${MOMS.business} here in Ambler. We service fleet vehicles right in your lot — no downtime driving to a shop, and no drivers sitting around waiting.`,
    ``,
    `For ${p.company}, ${fleetPhrase} would be ${ratePhrase}. That's a full synthetic oil change, filter, and fluids checked, done on-site while your crew works. Mobil 1 is available for +$10 per vehicle.`,
    ``,
    `To get on the schedule, just call us at ${MOMS.phone} or reply here — fleets book by phone or by email at ${MOMS.email}.`,
    ``,
    `And if you refer another fleet to us, you get a ${MOMS.referralCredit} credit.`,
    ``,
    `Thanks,`,
    `${MOMS.business}`,
    `${MOMS.address}`,
    `${MOMS.phone} · ${MOMS.email}`,
    ``,
    `—`,
    `${MOMS.business}, ${MOMS.address}.`,
    `Don't want these emails? Reply with "unsubscribe" and we'll take you off the list.`,
  ].join("\n");

  // b. SMS — Telnyx (≤320 chars)
  let smsBody =
    price != null
      ? `Hi ${greetName}, ${MOMS.business} (Ambler) services ${p.company}'s fleet right in your lot — no shop trips. Your rate: ${price}/vehicle${p.vehicle_count != null ? ` for ${p.vehicle_count} vehicles` : ""}. Call ${MOMS.phone} to book. Reply STOP to end.`
      : `Hi ${greetName}, ${MOMS.business} (Ambler) services ${p.company}'s fleet right in your lot — no shop trips. Custom fleet quote for 25+ vehicles. Call ${MOMS.phone} to book. Reply STOP to end.`;
  if (smsBody.length > 320) smsBody = smsBody.slice(0, 317) + "...";

  // c. Voice — ScreenMyCalls Voice (spoken follow-up call script)
  const voiceBody = [
    `Hi, this is a follow-up call from ${MOMS.business} in Ambler, for ${p.contact_name || "the fleet manager"} at ${p.company}.`,
    `We sent over our fleet pricing — for ${fleetPhrase} it works out to ${ratePhrase}, and we do the oil changes right in your lot, so there's no downtime driving to a shop.`,
    `If you'd like to get on the schedule, call us back at ${MOMS.phone}, or email ${MOMS.email}.`,
    `Thanks for your time.`,
  ].join(" ");

  // d. Postcard — Thanks.io
  const postcardSubject = "Your Fleet's Oil Changes — Done in Your Lot";
  const postcardBody = [
    `${p.company} — ${MOMS.business} brings full synthetic oil changes to your lot. No shop trips, no downtime.`,
    price != null
      ? `Fleets of ${p.vehicle_count}: ${price}/vehicle.`
      : `Volume fleets (25+): custom quote.`,
    `Mobil 1 +$10/vehicle. Call ${MOMS.phone} to book — fleets schedule by phone or email.`,
    `Refer another fleet, get a ${MOMS.referralCredit} credit.`,
    `${MOMS.business} · ${MOMS.address}`,
  ].join(" ");

  // e. Social — Postforme. PII-free: no prospect data, pairs with the campaign.
  const socialBody =
    `Fleet managers: your trucks don't have to leave the lot for an oil change. ${MOMS.business} comes to you — full synthetic service on-site at $120/vehicle for small fleets, with volume pricing down to $110. Serving Ambler & Montgomery County. Call ${MOMS.phone} to get your fleet on the schedule. #FleetMaintenance #MontgomeryCountyPA #SmallBusiness`;

  return [
    { step_order: 1, channel: "email", connection_id: "enginemailer", subject: emailSubject, body: emailBody },
    { step_order: 2, channel: "sms", connection_id: "telnyx", subject: null, body: smsBody },
    { step_order: 3, channel: "voice", connection_id: "screenmycalls-voice", subject: "Follow-up call script", body: voiceBody },
    { step_order: 4, channel: "postcard", connection_id: "thanks-io", subject: postcardSubject, body: postcardBody },
    { step_order: 5, channel: "social", connection_id: "postforme", subject: null, body: socialBody },
  ];
}

// ── Engine ──────────────────────────────────────────────────────────────────
// HONESTY RULE: this engine PREPARES sequences. Every step is stored with
// status 'prepared' — nothing is sent or dispatched by this app in v1.
// Dispatch happens through the owner's connector tooling after his approval.
export async function runFleetFollowup(prospectId: number) {
  await ensureFleetTables();
  const sql = db();
  const found: any[] = await sql.query(`SELECT * FROM reach.prospects WHERE id = $1`, [prospectId]);
  if (found.length === 0) throw new Error(`prospect ${prospectId} not found`);
  const prospect = found[0] as Prospect;

  const drafts = composeSteps(prospect);
  const runSteps = drafts.map((d) => ({
    step: `${d.channel} (${d.connection_id})`,
    connectionId: d.connection_id,
    ok: true,
    detail: "prepared — not sent (prepare mode)",
  }));
  const runs: any[] = await sql.query(
    `INSERT INTO reach.workflow_runs (started_at, finished_at, steps, status, workflow)
     VALUES (now(), now(), $1::jsonb, 'completed', 'fleet-followup') RETURNING id, started_at, finished_at, status, workflow`,
    [JSON.stringify(runSteps)]
  );
  const run = runs[0];

  const inserted: any[] = [];
  for (const d of drafts) {
    const rows: any[] = await sql.query(
      `INSERT INTO reach.sequence_steps (prospect_id, run_id, step_order, channel, connection_id, subject, body, status, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'prepared', $8) RETURNING id, step_order, channel, connection_id, subject, status`,
      [prospect.id, run.id, d.step_order, d.channel, d.connection_id, d.subject, d.body, PREPARED_DETAIL]
    );
    inserted.push(rows[0]);
  }
  await sql.query(`UPDATE reach.prospects SET status = 'in_sequence' WHERE id = $1`, [prospect.id]);

  return {
    ok: true,
    workflow: "fleet-followup",
    mode: "prepare",
    note: "Sequence composed and logged. Nothing was sent — dispatch requires the owner's approval.",
    runId: run.id,
    runStatus: run.status,
    prospect: { id: prospect.id, company: prospect.company, status: "in_sequence" },
    tier: tierFor(prospect.vehicle_count),
    stepsPrepared: inserted.length,
    steps: inserted,
  };
}

export async function prepareFleetFollowupBatch(limit = 20) {
  await ensureFleetTables();
  const lim = Math.max(1, Math.min(100, Math.floor(limit) || 20));
  const sql = db();
  const due: any[] = await sql.query(
    `SELECT id FROM reach.prospects WHERE status = 'new' ORDER BY id LIMIT $1`,
    [lim]
  );
  const runs = [];
  for (const row of due) runs.push(await runFleetFollowup(row.id));
  return {
    ok: true,
    workflow: "fleet-followup",
    mode: "prepare",
    note: "Sequences composed and logged. Nothing was sent — dispatch requires the owner's approval.",
    prepared: runs.length,
    runs,
  };
}

// ── Reads / writes used by the API routes ───────────────────────────────────
export async function listProspects() {
  await ensureFleetTables();
  const sql = db();
  const rows: any[] = await sql.query(
    `SELECT p.*, COALESCE(s.cnt, 0)::int AS steps_prepared
     FROM reach.prospects p
     LEFT JOIN (SELECT prospect_id, COUNT(*)::int AS cnt FROM reach.sequence_steps GROUP BY prospect_id) s
       ON s.prospect_id = p.id
     ORDER BY p.id`
  );
  return rows.map((r) => ({ ...r, tier: tierFor(r.vehicle_count) }));
}

export async function addProspect(input: {
  company?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  mailing_address?: string;
  vehicle_count?: number | string | null;
  source?: string;
}) {
  await ensureFleetTables();
  const company = String(input.company || "").trim();
  if (!company) throw new Error("company is required");
  const clean = (v: any) => {
    const s = v == null ? "" : String(v).trim();
    return s ? s : null;
  };
  let vehicles: number | null = null;
  if (input.vehicle_count != null && String(input.vehicle_count).trim() !== "") {
    const n = Number(input.vehicle_count);
    if (!Number.isFinite(n) || n < 0) throw new Error("vehicle_count must be a non-negative number");
    vehicles = Math.floor(n);
  }
  const sql = db();
  const rows: any[] = await sql.query(
    `INSERT INTO reach.prospects (company, contact_name, email, phone, mailing_address, vehicle_count, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [company, clean(input.contact_name), clean(input.email), clean(input.phone), clean(input.mailing_address), vehicles, clean(input.source) || "manual"]
  );
  return { ...rows[0], tier: tierFor(rows[0].vehicle_count) };
}

export async function getProspectSteps(prospectId: number) {
  await ensureFleetTables();
  const sql = db();
  const found: any[] = await sql.query(`SELECT * FROM reach.prospects WHERE id = $1`, [prospectId]);
  if (found.length === 0) return null;
  const steps: any[] = await sql.query(
    `SELECT id, run_id, step_order, channel, connection_id, subject, body, status, detail, created_at
     FROM reach.sequence_steps WHERE prospect_id = $1 ORDER BY created_at, step_order`,
    [prospectId]
  );
  return { prospect: { ...found[0], tier: tierFor(found[0].vehicle_count) }, steps };
}
