"use client";
import { useState } from "react";

export default function LoginForm({ authBase }: { authBase: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!authBase) {
      setMsg("Auth is not configured on the server. Check /api/neon/auth-status.");
      return;
    }
    setMsg("Signing in…");
    try {
      const res = await fetch(`${authBase}/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      setMsg(
        res.ok
          ? "Signed in."
          : `Sign-in failed (HTTP ${res.status}). Check the email/password and try again.`
      );
    } catch {
      setMsg("Could not reach the auth service from the browser.");
    }
  }
  return (
    <div>
      <h1>Login</h1>
      <p className="lede">Sign in with Neon Managed Auth.</p>
      <form onSubmit={submit} className="card">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="bigbtn" type="submit">Sign in</button>
        {msg ? <p>{msg}</p> : null}
      </form>
    </div>
  );
}
