import { neon } from "@neondatabase/serverless";
import type { AppId } from "./connections";

function url(): string {
  const u = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  if (!u) throw new Error("DATABASE_URL not configured");
  return u;
}
export function db() { return neon(url()); }

const SCHEMAS: AppId[] = ["reach", "studio", "ops"];

export async function ensureSchema(app: AppId): Promise<void> {
  const sql = db();
  // Schema names come from a fixed allowlist (AppId), never user input.
  await sql.query(`CREATE SCHEMA IF NOT EXISTS ${app}`);
  await sql.query(`CREATE TABLE IF NOT EXISTS ${app}.workflow_runs (
    id bigserial PRIMARY KEY,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'running'
  )`);
  await sql.query(`CREATE TABLE IF NOT EXISTS ${app}.items (
    id bigserial PRIMARY KEY,
    name text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
}

export async function ensureAllSchemas(): Promise<string[]> {
  for (const s of SCHEMAS) await ensureSchema(s);
  return SCHEMAS;
}
