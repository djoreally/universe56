"use client";

// Studio-only section: The Mobile Oil Change Podcast platform, ported from
// the standalone podcast audio extraction app into Universe56 Studio.
// Sections: extraction deck -> audio track library -> episode generator +
// episode list (publish toggle feeds the RSS route) -> RSS feed link, with
// the ported StudioAudioPlayer + WaveformVisualizer wired to the Studio
// audio-stream route.
import { useCallback, useEffect, useState } from "react";
import { Play, Pause, Rss, Copy, Check, Sparkles, Trash2 } from "lucide-react";
import { VideoExtractionDeck } from "./VideoExtractionDeck";
import { StudioAudioPlayer, type ActiveAudioItem } from "./StudioAudioPlayer";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { formatBytes, formatDuration } from "@/lib/audio-synthesis";
import type { StudioEpisode, StudioShow, StudioTrack } from "@/lib/studio-podcast";

const API = "/api/studio/podcast";

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

export default function StudioPodcast() {
  const [show, setShow] = useState<StudioShow | null>(null);
  const [tracks, setTracks] = useState<StudioTrack[]>([]);
  const [episodes, setEpisodes] = useState<StudioEpisode[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const [topic, setTopic] = useState("");
  const [topicTrackId, setTopicTrackId] = useState<string>("");

  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  const [activeItem, setActiveItem] = useState<ActiveAudioItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekRequest, setSeekRequest] = useState<{ seconds: number; nonce: number } | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [s, t, e] = await Promise.all([
        fetch(`${API}/show`).then((r) => r.json()),
        fetch(`${API}/audio-tracks`).then((r) => r.json()),
        fetch(`${API}/episodes`).then((r) => r.json()),
      ]);
      if (s.show) setShow(s.show);
      if (Array.isArray(t.tracks)) setTracks(t.tracks);
      if (Array.isArray(e.episodes)) setEpisodes(e.episodes);
    } catch (err: any) {
      setError(err?.message || "could not load podcast data");
    }
  }, []);
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const feedPath = show ? `${API}/rss/${show.slug}` : "";
  const feedUrl = origin && feedPath ? `${origin}${feedPath}` : feedPath;

  function playTrack(track: StudioTrack, localBlobUrl?: string | null) {
    setActiveItem({
      kind: "track",
      id: track.id,
      streamTrackId: track.id,
      title: track.title,
      subtitle: `${track.sourcePlatform} • ${track.sourceVideoName}`,
      durationSeconds: track.durationSeconds,
      localBlobUrl: localBlobUrl ?? null,
    });
    setCurrentTime(0);
    setIsPlaying(true);
  }

  function playEpisode(ep: StudioEpisode) {
    if (!ep.audioTrackId) return;
    setActiveItem({
      kind: "episode",
      id: ep.id,
      streamTrackId: ep.audioTrackId,
      title: ep.title,
      subtitle: show ? show.title : "Podcast episode",
      durationSeconds: ep.durationSeconds,
      coverImage: ep.coverImage || undefined,
      localBlobUrl: null,
    });
    setCurrentTime(0);
    setIsPlaying(true);
  }

  const activeTrack: StudioTrack | null = activeItem
    ? (tracks.find((t) => t.id === activeItem.streamTrackId) ?? null)
    : null;
  const activeEpisode: StudioEpisode | null =
    activeItem?.kind === "episode" ? (episodes.find((e) => e.id === activeItem.id) ?? null) : null;

  async function generateEpisode(ev: React.FormEvent) {
    ev.preventDefault();
    if (!topic.trim()) return;
    setBusy("generate");
    setError("");
    setMessage("");
    try {
      const r = await fetch(`${API}/episodes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          topic: topic.trim(),
          ...(topicTrackId ? { sourceTrackId: Number(topicTrackId) } : {}),
        }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error || `HTTP ${r.status}`);
      else {
        setMessage(`Draft created: Episode ${j.episode.episodeNumber} — “${j.episode.title}” (template-generated draft, ready to edit and publish).`);
        setTopic("");
        await loadAll();
      }
    } catch (err: any) {
      setError(err?.message || "generate failed");
    }
    setBusy("");
  }

  async function episodeFromTrack(track: StudioTrack) {
    setBusy(`ep-${track.id}`);
    setError("");
    setMessage("");
    try {
      const r = await fetch(`${API}/episodes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceTrackId: track.id }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error || `HTTP ${r.status}`);
      else {
        setMessage(`Draft episode created from “${track.title}”: Episode ${j.episode.episodeNumber} — “${j.episode.title}”.`);
        await loadAll();
      }
    } catch (err: any) {
      setError(err?.message || "create episode failed");
    }
    setBusy("");
  }

  async function togglePublish(ep: StudioEpisode) {
    const next = ep.status === "published" ? "draft" : "published";
    setBusy(`pub-${ep.id}`);
    setError("");
    try {
      const r = await fetch(`${API}/episodes/${ep.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error || `HTTP ${r.status}`);
      else await loadAll();
    } catch (err: any) {
      setError(err?.message || "publish toggle failed");
    }
    setBusy("");
  }

  async function deleteEp(ep: StudioEpisode) {
    setBusy(`del-${ep.id}`);
    setError("");
    try {
      const r = await fetch(`${API}/episodes/${ep.id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) setError(j.error || `HTTP ${r.status}`);
      else await loadAll();
    } catch (err: any) {
      setError(err?.message || "delete failed");
    }
    setBusy("");
  }

  async function copyFeed() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed — select the feed URL text and copy it manually.");
    }
  }

  return (
    <div style={activeItem ? { paddingBottom: 130 } : undefined}>
      <h2>Podcast Studio</h2>
      {show ? (
        <p className="lede">
          <strong>{show.title}</strong> — hosted by {show.author}. Extract audio
          from video, build episodes, publish to the RSS feed.
        </p>
      ) : (
        <p className="lede">Loading podcast show…</p>
      )}
      {error ? <p className="warn">Error: {error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}

      <VideoExtractionDeck
        defaultFormat="WAV"
        defaultSpeaker={show?.author ?? "Tyreese Burton"}
        onTrackExtracted={(track, localBlobUrl) => {
          loadAll();
          playTrack(track, localBlobUrl);
        }}
      />

      <h2>Audio Tracks ({tracks.length})</h2>
      {tracks.length === 0 ? (
        <p className="lede">No extracted tracks yet. Drop a video in the deck above to create the first one.</p>
      ) : (
        tracks.map((t) => (
          <div className="card" key={t.id} style={{ marginBottom: 18 }}>
            <h3>{t.title}</h3>
            <p style={{ marginTop: 0 }}>
              {t.sourcePlatform} • {t.sourceVideoName} • {formatDuration(t.durationSeconds)} •{" "}
              {t.lufsLoudness.toFixed(1)} LUFS • {formatBytes(t.fileSizeBytes)} •{" "}
              {t.hasCustomAudio ? "Stored in Neon Object Storage" : "Metadata only (player uses a synthesized preview tone)"}
            </p>
            <WaveformVisualizer peaks={t.waveformPeaks} durationSeconds={t.durationSeconds} height={56} compact />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
              <button
                className="bigbtn"
                style={{ marginTop: 0 }}
                onClick={() =>
                  activeItem?.kind === "track" && activeItem.id === t.id
                    ? setIsPlaying(!isPlaying)
                    : playTrack(t)
                }
              >
                {activeItem?.kind === "track" && activeItem.id === t.id && isPlaying ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Pause size={22} /> Pause</span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Play size={22} /> Play track</span>
                )}
              </button>
              <button style={secondaryBtn} onClick={() => episodeFromTrack(t)} disabled={busy === `ep-${t.id}`}>
                {busy === `ep-${t.id}` ? "Creating…" : "Create episode from track"}
              </button>
            </div>
          </div>
        ))
      )}

      {activeItem && activeTrack ? (
        <>
          <h2>Now Playing — Waveform</h2>
          <div className="card">
            <p style={{ marginTop: 0 }}>
              <strong>{activeItem.title}</strong> • {formatDuration(currentTime)} / {formatDuration(activeItem.durationSeconds)}
              {" "}— click the waveform or a chapter pin to seek.
            </p>
            <WaveformVisualizer
              peaks={activeTrack.waveformPeaks}
              durationSeconds={activeItem.durationSeconds}
              currentTimeSeconds={currentTime}
              isPlaying={isPlaying}
              chapters={activeEpisode?.chapters ?? []}
              onSeek={(seconds) => setSeekRequest({ seconds, nonce: Date.now() })}
              height={84}
            />
            {activeEpisode && activeEpisode.chapters.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                {activeEpisode.chapters.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSeekRequest({ seconds: c.timeSeconds, nonce: Date.now() })}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--line)",
                      padding: "10px 4px",
                      fontSize: 19,
                      cursor: "pointer",
                      color: "var(--ink)",
                    }}
                  >
                    <strong>{formatDuration(c.timeSeconds)}</strong> — {c.title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <h2>Generate an Episode Draft</h2>
      <div className="card">
        <form onSubmit={generateEpisode}>
          <label>
            Episode topic
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. How fleet accounts cut downtime with on-site oil changes"
              required
            />
          </label>
          <label>
            Build it from an extracted track (optional)
            <select
              value={topicTrackId}
              onChange={(e) => setTopicTrackId(e.target.value)}
              style={{
                fontSize: 20,
                padding: 14,
                border: "2px solid var(--line)",
                borderRadius: 10,
                width: "100%",
                margin: "6px 0 16px",
                background: "var(--card)",
                color: "var(--ink)",
              }}
            >
              <option value="">No track — topic only</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({formatDuration(t.durationSeconds)})
                </option>
              ))}
            </select>
          </label>
          <button className="bigbtn" type="submit" disabled={busy === "generate"}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={22} /> {busy === "generate" ? "Generating…" : "Generate draft episode"}
            </span>
          </button>
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            Drafts are built by the built-in template generator (title, summary,
            chapters, transcript, show notes) — no external AI service is called.
          </p>
        </form>
      </div>

      <h2>Episodes ({episodes.length})</h2>
      {episodes.length === 0 ? (
        <p className="lede">No episodes yet. Generate a draft above, or create one from an extracted track.</p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr><th>#</th><th>Episode</th><th>Length</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id}>
                  <td>{ep.episodeNumber}</td>
                  <td>
                    <strong>{ep.title}</strong>
                    <br />
                    <span style={{ color: "var(--muted)" }}>{ep.summary.slice(0, 140)}{ep.summary.length > 140 ? "…" : ""}</span>
                  </td>
                  <td>{formatDuration(ep.durationSeconds)}</td>
                  <td>{ep.status === "published" ? <span className="ok">Published</span> : "Draft"}</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      <button
                        className="bigbtn"
                        style={{ marginTop: 0, padding: "12px 20px", fontSize: 19 }}
                        onClick={() => togglePublish(ep)}
                        disabled={busy === `pub-${ep.id}`}
                      >
                        {busy === `pub-${ep.id}` ? "Saving…" : ep.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      {ep.audioTrackId ? (
                        <button style={{ ...secondaryBtn, padding: "10px 18px", fontSize: 19 }} onClick={() => playEpisode(ep)}>
                          Play
                        </button>
                      ) : null}
                      <button
                        style={{ ...secondaryBtn, padding: "10px 18px", fontSize: 19 }}
                        onClick={() => deleteEp(ep)}
                        disabled={busy === `del-${ep.id}`}
                        title="Delete episode"
                      >
                        <Trash2 size={19} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Podcast RSS Feed</h2>
      <div className="card">
        <h3 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Rss size={26} /> {show ? show.title : "Podcast feed"}
        </h3>
        <p>
          Published episodes appear in this feed automatically. Submit it once
          to Apple Podcasts, Spotify, and other directories.
        </p>
        <pre>{feedUrl || feedPath}</pre>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <button className="bigbtn" style={{ marginTop: 0 }} onClick={copyFeed}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {copied ? <Check size={22} /> : <Copy size={22} />} {copied ? "Copied!" : "Copy feed URL"}
            </span>
          </button>
          {feedPath ? (
            <a style={{ ...secondaryBtn, textDecoration: "none", display: "inline-block" }} href={feedPath} target="_blank" rel="noreferrer">
              Open feed
            </a>
          ) : null}
        </div>
      </div>

      <StudioAudioPlayer
        activeItem={activeItem}
        isPlaying={isPlaying}
        seekRequest={seekRequest}
        onPlayStateChange={setIsPlaying}
        onTimeUpdate={setCurrentTime}
        onClose={() => {
          setIsPlaying(false);
          setActiveItem(null);
        }}
      />
    </div>
  );
}
