"use client";
import { useState } from "react";
import Link from "next/link";

// Password reset landing for Neon Managed Auth (Better Auth).
// The reset email link passes through the auth server and lands here with
// ?token=...; we POST { newPassword, token } to {authBase}/reset-password.
export default function ResetPasswordForm({ authBase, token }: { authBase: string; token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setOkMsg("");
    if (!token) {
      setMsg("This page needs the link from your reset email. Request a fresh link from the Login page.");
      return;
    }
    if (password !== confirm) {
      setMsg("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${authBase}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: password, token }),
      });
      if (res.ok) {
        setOkMsg("Password updated. You can sign in with your new password now.");
        setPassword("");
        setConfirm("");
      } else {
        let m = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          m = j?.message || j?.error?.message || m;
        } catch { /* keep status */ }
        setMsg(`Reset failed: ${m}`);
      }
    } catch {
      setMsg("Could not reach the auth service from the browser.");
    }
    setBusy(false);
  }

  return (
    <div>
      <h1>Set a new password</h1>
      <p className="lede">
        Choose a password you will remember this time — or let your password
        manager save it and check it landed in the manager before you leave.
      </p>
      <form onSubmit={submit} className="card" style={{ maxWidth: 640 }}>
        <label htmlFor="newPassword">New password</label>
        <input id="newPassword" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <label htmlFor="confirmPassword">Type it again</label>
        <input id="confirmPassword" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <button className="bigbtn" type="submit" disabled={busy}>
          {busy ? "Working…" : "Update password"}
        </button>
        {okMsg ? (
          <p className="ok">
            {okMsg} <Link href="/login">Go to Login</Link>
          </p>
        ) : null}
        {msg ? <p className="warn">{msg}</p> : null}
      </form>
    </div>
  );
}
