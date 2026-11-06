"use client";
import { useEffect, useState } from "react";
import { APP_META, connectionsForApp, type AppId } from "@/lib/connections";

export default function AppPage({ app }: { app: AppId }) {
  const meta = APP_META[app];
  const conns = connectionsForApp(app);
  const [running, setRunning] = useState(false);
  const [latest, setLatest] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string>("");

  async function loadHistory() {
    try {
      const r = await fetch(`${meta.apiBase}/runs`);
      const j = await r.json();
      if (Array.isArray(j)) setHistory(j);
    } catch { /* history is best-effort on first load */ }
  }
  useEffect(() => { loadHistory(); }, []);

  async function run() {
    setRunning(true); setError("");
    try {
      const r = await fetch(`${meta.apiBase}/run`);
      const j = await r.json();
      if (!r.ok) setError(j.error || `HTTP ${r.status}`);
      else { setLatest(j); await loadHistory(); }
    } catch (e: any) { setError(e?.message || "run failed"); }
    setRunning(false);
  }

  return (
    <div>
      <h1>{meta.title}</h1>
      <p className="lede">{meta.tagline}. Independent app: routes under /{app}, Postgres schema <strong>{meta.schema}</strong>, API under {meta.apiBase}, storage prefix {app}/.</p>

      <button className="bigbtn" onClick={run} disabled={running}>{running ? "Running…" : "Run workflow"}</button>
      {error ? <p className="warn">Run error: {error}</p> : null}

      <h2>Connections ({conns.length})</h2>
      <div className="card">
        <table>
          <thead><tr><th>Connection</th><th>Type</th><th>Workflow step</th><th>What it does</th></tr></thead>
          <tbody>
            {conns.map((c) => (<tr key={c.id}><td><strong>{c.name}</strong><br />{c.host}</td><td>{c.kind}</td><td>{c.step}</td><td>{c.purpose}</td></tr>))}
          </tbody>
        </table>
      </div>

      {latest ? (<><h2>Latest run</h2><pre>{JSON.stringify(latest, null, 2)}</pre></>) : null}

      <h2>Run history</h2>
      {history.length === 0 ? <p className="lede">No runs yet. Run the workflow above.</p> : (
        <div className="card"><table>
          <thead><tr><th>Run</th><th>Started</th><th>Status</th><th>Steps</th></tr></thead>
          <tbody>{history.map((r: any) => (<tr key={r.id}><td>#{r.id}</td><td>{String(r.started_at)}</td><td>{r.status}</td><td>{Array.isArray(r.steps) ? r.steps.length : 0}</td></tr>))}</tbody>
        </table></div>
      )}
    </div>
  );
}
