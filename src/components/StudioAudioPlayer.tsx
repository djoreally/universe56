"use client";

// Ported from the standalone podcast app (components/StudioAudioPlayer.tsx).
// Transport logic unchanged; stream/download URLs point at the Universe56
// Studio route (/api/studio/podcast/audio-stream/[id]) and styling is
// adapted from Tailwind to inline styles + Universe56 CSS vars.
import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  X,
  Disc3,
  Loader2,
} from "lucide-react";
import { formatDuration } from "@/lib/audio-synthesis";

export interface ActiveAudioItem {
  kind: "track" | "episode";
  id: number;
  streamTrackId: number;
  title: string;
  subtitle: string;
  durationSeconds: number;
  coverImage?: string;
  localBlobUrl?: string | null;
}

interface StudioAudioPlayerProps {
  activeItem: ActiveAudioItem | null;
  isPlaying: boolean;
  seekRequest: { seconds: number; nonce: number } | null;
  onPlayStateChange: (playing: boolean) => void;
  onTimeUpdate: (seconds: number) => void;
  onClose: () => void;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];
const STREAM_BASE = "/api/studio/podcast/audio-stream";

const iconBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 44,
  height: 44,
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
};

export function StudioAudioPlayer({
  activeItem,
  isPlaying,
  seekRequest,
  onPlayStateChange,
  onTimeUpdate,
  onClose,
}: StudioAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const pendingSeekSecRef = useRef<number | null>(null);

  const playbackRate = SPEED_OPTIONS[speedIndex] ?? 1;

  const audioSrc = activeItem
    ? activeItem.localBlobUrl || `${STREAM_BASE}/${activeItem.streamTrackId}`
    : undefined;

  // Sync play/pause state with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeItem) return;
    audio.playbackRate = playbackRate;
    audio.volume = isMuted ? 0 : volume;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          onPlayStateChange(false);
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, activeItem?.kind, activeItem?.id, audioSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const syncDomAudioSeek = (targetSec: number, durationSec: number) => {
    const clamped = Math.max(0, Math.min(durationSec, targetSec));
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      const ratio = durationSec > 0 ? clamped / durationSec : 0;
      audio.currentTime = Math.max(
        0,
        Math.min(audio.duration - 0.05, ratio * audio.duration)
      );
      pendingSeekSecRef.current = null;
    } else {
      pendingSeekSecRef.current = clamped;
    }
  };

  const applySeekSeconds = (targetSec: number) => {
    if (!activeItem) return;
    const clamped = Math.max(0, Math.min(activeItem.durationSeconds, targetSec));
    setDisplayTime(clamped);
    onTimeUpdate(clamped);
    syncDomAudioSeek(clamped, activeItem.durationSeconds);
  };

  // Handle external seek requests (from waveform click or chapter click)
  useEffect(() => {
    if (!seekRequest || !activeItem) return;
    syncDomAudioSeek(seekRequest.seconds, activeItem.durationSeconds);
  }, [seekRequest?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeItem) {
    return null;
  }

  const progressPercent =
    activeItem.durationSeconds > 0
      ? Math.max(0, Math.min(100, (displayTime / activeItem.durationSeconds) * 100))
      : 0;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        borderTop: "2px solid var(--line)",
        background: "var(--card)",
        boxShadow: "0 -4px 24px rgba(16,24,40,0.12)",
      }}
    >
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onLoadedMetadata={(e) => {
          setIsBuffering(false);
          const audio = e.currentTarget;
          audio.playbackRate = playbackRate;
          if (
            pendingSeekSecRef.current !== null &&
            Number.isFinite(audio.duration) &&
            audio.duration > 0
          ) {
            const ratio =
              activeItem.durationSeconds > 0
                ? pendingSeekSecRef.current / activeItem.durationSeconds
                : 0;
            audio.currentTime = ratio * audio.duration;
            pendingSeekSecRef.current = null;
          }
        }}
        onSeeked={(e) => {
          const audio = e.currentTarget;
          if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
          const mappedSeconds = Math.round(
            (audio.currentTime / audio.duration) * activeItem.durationSeconds
          );
          setDisplayTime(mappedSeconds);
          onTimeUpdate(mappedSeconds);
        }}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
          const mappedSeconds = Math.round(
            (audio.currentTime / audio.duration) * activeItem.durationSeconds
          );
          setDisplayTime(mappedSeconds);
          onTimeUpdate(mappedSeconds);
        }}
        onEnded={() => {
          onPlayStateChange(false);
          setDisplayTime(0);
          onTimeUpdate(0);
        }}
      />

      {/* Top hairline progress bar for instant visual scrubbing */}
      <div
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
          applySeekSeconds(Math.round(ratio * activeItem.durationSeconds));
        }}
        style={{ position: "relative", height: 10, width: "100%", cursor: "pointer", background: "var(--bg)" }}
        title="Click to seek"
      >
        <div style={{ width: `${progressPercent}%`, height: "100%", background: "var(--accent)" }} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "10px 20px 14px",
          flexWrap: "wrap",
        }}
      >
        {/* Track / Episode Info */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              width: 52,
              height: 52,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: "var(--ink)",
              color: "var(--accent)",
            }}
          >
            <Disc3 size={26} style={isPlaying ? { animation: "u56spin 5s linear infinite" } : undefined} />
            <style>{`@keyframes u56spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 19, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ color: "var(--muted)", fontSize: 14, textTransform: "uppercase", letterSpacing: 1, marginRight: 8 }}>
                {activeItem.kind === "episode" ? "Episode" : "Audio Stem"}
              </span>
              {activeItem.title}
            </p>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {activeItem.subtitle}
            </p>
          </div>
        </div>

        {/* Transport Controls + Timecode */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={() => applySeekSeconds(displayTime - 15)} style={iconBtn} title="Rewind 15 seconds">
            <RotateCcw size={22} />
          </button>
          <button
            type="button"
            onClick={() => onPlayStateChange(!isPlaying)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              cursor: "pointer",
            }}
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            {isBuffering ? <Loader2 size={24} /> : isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button type="button" onClick={() => applySeekSeconds(displayTime + 15)} style={iconBtn} title="Forward 15 seconds">
            <RotateCw size={22} />
          </button>
          <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 17, padding: "6px 10px", border: "2px solid var(--line)", borderRadius: 10 }}>
            <span>{formatDuration(displayTime)}</span>
            <span style={{ color: "var(--muted)" }}> / {formatDuration(activeItem.durationSeconds)}</span>
          </div>
        </div>

        {/* Speed, Volume, Download & Dismiss */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flex: 1 }}>
          <button
            type="button"
            onClick={() => setSpeedIndex((prev) => (prev + 1) % SPEED_OPTIONS.length)}
            style={{ border: "2px solid var(--line)", background: "var(--card)", borderRadius: 10, padding: "8px 12px", fontSize: 17, fontWeight: 700, cursor: "pointer", color: "var(--ink)" }}
            title="Cycle playback speed"
          >
            {playbackRate}x
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, border: "2px solid var(--line)", borderRadius: 10, padding: "6px 10px" }}>
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              style={{ ...iconBtn, width: 32, height: 32 }}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setIsMuted(false);
                setVolume(parseFloat(e.target.value));
              }}
              aria-label="Volume"
              style={{ width: 90, margin: 0, padding: 0 }}
            />
          </div>
          <a
            href={activeItem.localBlobUrl || `${STREAM_BASE}/${activeItem.streamTrackId}?download=1`}
            download={`${activeItem.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.wav`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "2px solid var(--line)",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 17,
              fontWeight: 700,
              color: "var(--ink)",
              textDecoration: "none",
            }}
            title="Download WAV audio"
          >
            <Download size={18} />
            <span>WAV</span>
          </a>
          <button type="button" onClick={onClose} style={iconBtn} title="Close audio player">
            <X size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
