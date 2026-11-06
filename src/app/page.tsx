"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { APP_META, type AppId } from "@/lib/connections";

// Universe56 home: live command center for MOMS. Every number on this page
// is fetched from the app's own APIs on mount — connection counts from
// /api/connections, latest runs from each app's /runs read, Reach fleet
// stats from /api/reach/prospects, Studio podcast stats from
// /api/studio/podcast/*, and Neon service dots from the /api/neon/* status
// routes. Nothing here is hard-coded except the copy.

const APPS: AppId[] = ["reach", "studio", "ops"];

const JOB_LINES: Record<AppId, string> = {
  reach: "Fleet follow-up sequences and customer contact — email, SMS, voice, postcards, and social, all prepared and logged before anything sends.",
  studio: "Content and media — video-to-audio extraction, episodes, and publishing for The Mobile Oil Change Podcast.",
  ops: "The back-office snapshot — documents, money, deploys, infrastructure, and prospect research in one place.",
};

type DotState = "up" | "down" | "unknown" | "loading";

function dotColor(state: DotState): string {
  if (state === "up") return "#12805c";
  if (state === "down") return "#b54708";
  return "#98a2b3";
}

function fmtTime(v: any): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

interface AppStats {
  connections: number | null;
  latestRun: { status: string; started_at: any } | null;
  runsLoaded: boolean;
}

export default function Home() {
  const [totalConnections, setTotalConnections] = useState<number | null>(null);
  const [connectionsOk, setConnectionsOk] = useState<boolean | null>(null);
  const [appStats, setAppStats] = useState<Record<AppId, AppStats>>({
    reach: { connections: null, latestRun: null, runsLoaded: false },
    studio: { connections: null, latestRun: null, runsLoaded: false },
    ops: { connections: null, latestRun: null, runsLoaded: false },
  });
  const [fleet, setFleet] = useState<{ inSequence: number; stepsPrepared: number; total: number } | null>(null);
  const [podcast, setPodcast] = useState<{ showTitle: string; episodes: number; published: number } | null>(null);
  const [services, setServices] = useState<{ name: string; state: DotState; note: string }[]>([
    { name: "Postgres", state: "loading", note: "Checking…" },
    { name: "Auth", state: "loading", note: "Checking…" },
    { name: "Object Storage", state: "unknown", note: "Not probed here (its check writes a test file)" },
    { name: "Functions", state: "unknown", note: "No read-only probe on the homepage" },
    { name: "Realtime", state: "loading", note: "Checking…" },
    { name: "AI Gateway", state: "loading", note: "Checking…" },
  ]);

  useEffect(() => {
    let cancelled = false;
    const setService = (name: string, state: DotState, note: string) => {
      if (cancelled) return;
      setServices((prev) => prev.map((s) => (s.name === name ? { name, state, note } : s)));
    };

    // Connection registry + per-app counts and latest runs.
    fetch("/api/connections")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setTotalConnections(j.count ?? null);
        setConnectionsOk(j.countOk ?? null);
        const counts: Record<AppId, number> = { reach: 0, studio: 0, ops: 0 };
        for (const c of j.connections ?? []) {
          if (c.app === "reach" || c.app === "studio" || c.app === "ops") counts[c.app as AppId] += 1;
        }
        setAppStats((prev) => ({
          reach: { ...prev.reach, connections: counts.reach },
          studio: { ...prev.studio, connections: counts.studio },
          ops: { ...prev.ops, connections: counts.ops },
        }));
      })
      .catch(() => {});

    for (const app of APPS) {
      fetch(`/api/${app}/runs`)
        .then((r) => r.json())
        .then((j) => {
          if (cancelled || !Array.isArray(j)) return;
          const latest = j.length > 0 ? j[0] : null;
          setAppStats((prev) => ({
            ...prev,
            [app]: {
              ...prev[app],
              latestRun: latest ? { status: latest.status, started_at: latest.started_at } : null,
              runsLoaded: true,
            },
          }));
        })
        .catch(() => {
          if (!cancelled) {
            setAppStats((prev) => ({ ...prev, [app]: { ...prev[app], runsLoaded: true } }));
          }
        });
    }

    // Reach fleet follow-up stats.
    fetch("/api/reach/prospects")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !Array.isArray(j)) return;
        setFleet({
          total: j.length,
          inSequence: j.filter((p: any) => p.status === "in_sequence").length,
          stepsPrepared: j.reduce((sum: number, p: any) => sum + (Number(p.steps_prepared) || 0), 0),
        });
      })
      .catch(() => {});

    // Studio podcast stats.
    Promise.all([
      fetch("/api/studio/podcast/show").then((r) => r.json()).catch(() => ({})),
      fetch("/api/studio/podcast/episodes").then((r) => r.json()).catch(() => ({})),
    ]).then(([s, e]) => {
      if (cancelled) return;
      const eps = Array.isArray(e.episodes) ? e.episodes : [];
      setPodcast({
        showTitle: s.show?.title ?? "Podcast",
        episodes: eps.length,
        published: eps.filter((ep: any) => ep.status === "published").length,
      });
    });

    // Neon services strip.
    fetch("/api/neon/init")
      .then((r) => r.json())
      .then((j) => setService("Postgres", j.ok ? "up" : "down", j.ok ? "Database and app schemas responding" : "Database check failed"))
      .catch(() => setService("Postgres", "down", "Database check failed"));
    fetch("/api/neon/auth-status")
      .then((r) => r.json())
      .then((j) => setService("Auth", j.reachable ? "up" : "down", j.reachable ? `Neon Managed Auth reachable (${j.host ?? "auth host"})` : "Auth service not reachable"))
      .catch(() => setService("Auth", "down", "Auth service not reachable"));
    fetch("/api/neon/realtime-status")
      .then((r) => r.json())
      .then((j) => setService("Realtime", j.reachable ? "up" : "down", j.reachable ? "Realtime endpoint reachable" : "Realtime endpoint not reachable"))
      .catch(() => setService("Realtime", "down", "Realtime endpoint not reachable"));
    fetch("/api/neon/ai-test")
      .then((r) => r.json())
      .then((j) =>
        setService(
          "AI Gateway",
          j.ok ? "up" : "down",
          j.ok ? "AI Gateway answering" : `Blocked on the current Neon plan${j.detail ? ` — ${String(j.detail).slice(0, 90)}` : ""}`
        )
      )
      .catch(() => setService("AI Gateway", "down", "Blocked on the current Neon plan"));

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1>Universe56</h1>
      <p className="lede">
        <strong>Three independent apps. Every connection working for MOMS.</strong>
      </p>
      <p className="lede">
        Live in production on Vercel, backed by Neon.{" "}
        {totalConnections != null ? (
          <>
            <strong>{totalConnections} API connections</strong> registered
            {connectionsOk ? " and accounted for" : ""} — each one belongs to
            exactly one app and works in that app's workflows.
          </>
        ) : (
          "Loading the connection registry…"
        )}
      </p>

      <div className="grid">
        {APPS.map((a) => {
          const stats = appStats[a];
          return (
            <div className="card" key={a}>
              <h3>{APP_META[a].title}</h3>
              <p>{JOB_LINES[a]}</p>
              <p>
                <strong>{stats.connections != null ? `${stats.connections} connections` : "Loading connections…"}</strong>
                <br />
                {stats.runsLoaded ? (
                  stats.latestRun ? (
                    <>
                      Latest workflow run: <strong>{stats.latestRun.status}</strong>
                      <br />
                      {fmtTime(stats.latestRun.started_at)}
                    </>
                  ) : (
                    "No workflow runs yet"
                  )
                ) : (
                  "Loading latest run…"
                )}
              </p>
              {a === "reach" ? (
                <p>
                  {fleet ? (
                    <>
                      <strong>{fleet.inSequence} of {fleet.total} prospects in sequence</strong>
                      <br />
                      {fleet.stepsPrepared} follow-up steps prepared — nothing sends without approval
                    </>
                  ) : (
                    "Loading fleet follow-up stats…"
                  )}
                </p>
              ) : null}
              {a === "studio" ? (
                <p>
                  {podcast ? (
                    <>
                      <strong>{podcast.showTitle}</strong>
                      <br />
                      {podcast.episodes} episode{podcast.episodes === 1 ? "" : "s"} • {podcast.published} published •{" "}
                      <a href="/api/studio/podcast/rss/mobile-oil-change-podcast">RSS feed</a>
                    </>
                  ) : (
                    "Loading podcast stats…"
                  )}
                </p>
              ) : null}
              <Link className="bigbtn" href={`/${a}`}>
                Open {APP_META[a].title}
              </Link>
            </div>
          );
        })}
      </div>

      <h2>Neon services</h2>
      <div className="card">
        {services.map((s) => (
          <p key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 14, margin: "14px 0" }}>
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: dotColor(s.state),
                flexShrink: 0,
                alignSelf: "center",
              }}
            />
            <span>
              <strong style={{ fontSize: 23 }}>{s.name}</strong>
              <br />
              <span style={{ color: "var(--muted)" }}>{s.note}</span>
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
