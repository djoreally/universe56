"use client";
import { useEffect, useState } from "react";

// Reach-only section: fleet follow-up sequence preparation for MOMS.
// PREPARE MODE: sequences are composed and logged here. Nothing sends
// until dispatch is approved by the owner.
export default function FleetFollowup() {
  const [prospects, setProspects] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null); // { prospect, steps }
  const [busy, setBusy] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [form, setForm] = useState({
    company: "",
    contact_name: "",
    email: "",
    phone: "",
    mailing_address: "",
    vehicle_count: "",
    source: "",
  });

  async function loadProspects() {
    try {
      const r = await fetch("/api/reach/prospects");
      const j = await r.json();
      if (Array.isArray(j)) setProspects(j);
      else if (j?.error) setError(j.error);
    } catch (e: any) {
      setError(e?.message || "could not load prospects");
    }
  }
  useEffect(() => { loadProspects(); }, []);

  async function addProspect(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add"); setError(""); setMessage("");
    try {
      const r = await fetch("/api/reach/prospects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          vehicle_count: form.vehicle_count === "" ? null : Number(form.vehicle_count),
        }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error || `HTTP ${r.status}`);
      else {
        setMessage(`Added prospect: ${j.prospect.company}`);
        setForm({ company: "", contact_name: "", email: "", phone: "", mailing_address: "", vehicle_count: "", source: "" });
        await loadProspects();
      }
    } catch (err: any) { setError(err?.message || "add failed"); }
    setBusy("");
  }

  async function prepareOne(id: number, company: string) {
    setBusy(`one-${id}`); setError(""); setMessage("");
    try {
      const r = await fetch("/api/reach/fleet-followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prospectId: id }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error || `HTTP ${r.status}`);
      else {
        setMessage(`Prepared ${j.stepsPrepared} steps for ${company} (run #${j.runId}). Nothing sent.`);
        await loadProspects();
        await viewSteps(id);
      }
    } catch (err: any) { setError(err?.message || "prepare failed"); }
    setBusy("");
  }

  async function prepareBatch() {
    setBusy("batch"); setError(""); setMessage("");
    try {
      const r = await fetch("/api/reach/fleet-followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batch: true, limit: 20 }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error || `HTTP ${r.status}`);
      else {
        setMessage(`Batch done: prepared sequences for ${j.prepared} prospect(s). Nothing sent.`);
        await loadProspects();
      }
    } catch (err: any) { setError(err?.message || "batch failed"); }
    setBusy("");
  }

  async function viewSteps(id: number) {
    setError("");
    try {
      const r = await fetch(`/api/reach/fleet-followup?prospectId=${id}`);
      const j = await r.json();
      if (!r.ok) setError(j.error || `HTTP ${r.status}`);
      else setSelected(j);
    } catch (err: any) { setError(err?.message || "could not load steps"); }
  }

  const secondaryBtn: React.CSSProperties = {
    background: "transparent",
    color: "var(--accent)",
    border: "2px solid var(--accent)",
    borderRadius: 12,
    padding: "12px 22px",
    fontSize: 20,
    fontWeight: 800,
    cursor: "pointer",
  };

  return (
    <div>
      <h2>Fleet Follow-Up</h2>
      <p className="warn">
        Prepare mode: sequences are composed and logged here. Nothing sends until dispatch is approved.
      </p>
      {error ? <p className="warn">Error: {error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}

      <button className="bigbtn" onClick={prepareBatch} disabled={busy === "batch"}>
        {busy === "batch" ? "Preparing…" : "Prepare batch (all new prospects)"}
      </button>

      <h2>Prospects</h2>
      {prospects.length === 0 ? (
        <p className="lede">No prospects yet. Add one below, or run the Neon init to load the two TEST prospects.</p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr><th>Company</th><th>Contact</th><th>Vehicles</th><th>Tier price</th><th>Status</th><th>Steps prepared</th><th>Action</th></tr>
            </thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.company}</strong>{p.is_test ? <><br />TEST</> : null}<br />{p.email || ""}</td>
                  <td>{p.contact_name || "—"}<br />{p.phone || ""}</td>
                  <td>{p.vehicle_count ?? "—"}</td>
                  <td>{p.tier?.price != null ? `$${p.tier.price}/vehicle` : p.tier?.label}</td>
                  <td>{p.status}</td>
                  <td>{p.steps_prepared}</td>
                  <td>
                    <button className="bigbtn" style={{ marginTop: 0 }} onClick={() => prepareOne(p.id, p.company)} disabled={busy === `one-${p.id}`}>
                      {busy === `one-${p.id}` ? "Preparing…" : "Prepare sequence"}
                    </button>
                    <br />
                    <button style={{ ...secondaryBtn, marginTop: 10 }} onClick={() => viewSteps(p.id)}>
                      View steps
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Add a prospect</h2>
      <div className="card">
        <form onSubmit={addProspect}>
          <label>Company (required)
            <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required />
          </label>
          <label>Contact name
            <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </label>
          <label>Email
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>Phone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>Mailing address
            <input value={form.mailing_address} onChange={(e) => setForm({ ...form, mailing_address: e.target.value })} />
          </label>
          <label>Vehicle count
            <input type="number" min="0" value={form.vehicle_count} onChange={(e) => setForm({ ...form, vehicle_count: e.target.value })} />
          </label>
          <label>Source
            <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </label>
          <button className="bigbtn" type="submit" disabled={busy === "add"}>
            {busy === "add" ? "Adding…" : "Add prospect"}
          </button>
        </form>
      </div>

      {selected ? (
        <>
          <h2>Sequence for {selected.prospect.company}</h2>
          <p className="lede">
            Status: {selected.prospect.status} · {selected.steps.length} step(s) composed.
            All steps are <strong>prepared</strong> — nothing has been sent.
          </p>
          {selected.steps.length === 0 ? (
            <p className="lede">No steps yet. Use “Prepare sequence” for this prospect.</p>
          ) : (
            selected.steps.map((s: any) => (
              <div className="card" key={s.id} style={{ marginBottom: 18 }}>
                <h3>Step {s.step_order} — {s.channel} <span style={{ fontSize: 20, color: "var(--muted)" }}>via {s.connection_id} · {s.status}</span></h3>
                {s.subject ? <p><strong>Subject / headline:</strong> {s.subject}</p> : null}
                <pre>{s.body}</pre>
                <p style={{ color: "var(--muted)" }}>{s.detail}</p>
              </div>
            ))
          )}
        </>
      ) : null}
    </div>
  );
}
