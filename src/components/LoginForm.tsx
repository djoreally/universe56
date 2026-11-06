"use client";
import { useState } from "react";

// Sign in / Sign up against Neon Managed Auth (Better Auth email endpoints).
// Sign-in:  POST {authBase}/sign-in/email  { email, password }
// Sign-up:  POST {authBase}/sign-up/email  { name, email, password }
// Server error messages are surfaced verbatim so the owner sees exactly
// what the auth service said.
export default function LoginForm({ authBase }: { authBase: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function serverMessage(res: Response): Promise<string> {
    try {
      const j = await res.json();
      return j?.message || j?.error?.message || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setOkMsg("");
    if (!authBase) {
      setMsg("Auth is not configured on the server. Check /api/neon/auth-status.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await fetch(`${authBase}/sign-up/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, email, password }),
        });
        if (res.ok) {
          setOkMsg(`Account created for ${email}. Now sign in with your new account.`);
          setMode("signin");
          setPassword("");
        } else {
          setMsg(`Sign-up failed: ${await serverMessage(res)}`);
        }
      } else {
        const res = await fetch(`${authBase}/sign-in/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        if (res.ok) {
          setOkMsg("Signed in.");
        } else {
          setMsg(`Sign-in failed: ${await serverMessage(res)}`);
        }
      }
    } catch {
      setMsg("Could not reach the auth service from the browser.");
    }
    setBusy(false);
  }

  async function forgotPassword() {
    setMsg("");
    setOkMsg("");
    if (!email) {
      setMsg("Type your email above first, then tap Forgot password.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${authBase}/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, redirectTo: `${window.location.origin}/reset-password` }),
      });
      let m = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        m = j?.message || m;
      } catch { /* keep status */ }
      if (res.ok) setOkMsg(m);
      else setMsg(`Reset request failed: ${m}`);
    } catch {
      setMsg("Could not reach the auth service from the browser.");
    }
    setBusy(false);
  }

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    borderRadius: 12,
    padding: "14px 20px",
    fontSize: 21,
    fontWeight: 800,
    cursor: "pointer",
    border: "2px solid var(--accent)",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "#fff" : "var(--accent)",
  });

  return (
    <div>
      <h1>{mode === "signin" ? "Login" : "Create your account"}</h1>
      <p className="lede">
        Dashboards are open — you don't need an account to use Universe56
        today. This login is for app users.
      </p>

      <div style={{ display: "flex", gap: 12, maxWidth: 640, marginBottom: 20 }}>
        <button type="button" style={toggleBtn(mode === "signin")} onClick={() => { setMode("signin"); setMsg(""); setOkMsg(""); }}>
          Sign in
        </button>
        <button type="button" style={toggleBtn(mode === "signup")} onClick={() => { setMode("signup"); setMsg(""); setOkMsg(""); }}>
          Sign up
        </button>
      </div>

      <form onSubmit={submit} className="card" style={{ maxWidth: 640 }}>
        {mode === "signup" ? (
          <>
            <label htmlFor="name">Name</label>
            <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </>
        ) : null}
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="bigbtn" type="submit" disabled={busy}>
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        {okMsg ? <p className="ok">{okMsg}</p> : null}
        {msg ? <p className="warn">{msg}</p> : null}
        {mode === "signin" ? (
          <button type="button" className="bigbtn" style={{ marginTop: 16 }} onClick={forgotPassword} disabled={busy}>
            Forgot password — email me a reset link
          </button>
        ) : null}
      </form>

      {mode === "signin" ? (
        <p className="lede" style={{ marginTop: 20 }}>
          No account yet? Use <strong>Sign up</strong> above to create one with
          your name, email, and a password you choose.
        </p>
      ) : null}
    </div>
  );
}
