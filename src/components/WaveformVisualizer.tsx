"use client";

// Ported from the standalone podcast app (components/WaveformVisualizer.tsx).
// Logic unchanged (peaks, progress, hover timecode, chapter pins, keyboard
// seek); styling adapted from Tailwind to Universe56's inline styles + CSS
// vars to match the rest of the app.
import React, { useRef, useState } from "react";
import type { EpisodeChapter } from "@/lib/studio-podcast";
import { formatDuration } from "@/lib/audio-synthesis";

interface WaveformVisualizerProps {
  peaks: number[];
  durationSeconds: number;
  currentTimeSeconds?: number;
  isPlaying?: boolean;
  onSeek?: (seconds: number) => void;
  chapters?: EpisodeChapter[];
  height?: number;
  compact?: boolean;
}

export function WaveformVisualizer({
  peaks,
  durationSeconds,
  currentTimeSeconds = 0,
  isPlaying = false,
  onSeek,
  chapters = [],
  height = 64,
  compact = false,
}: WaveformVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const safePeaks =
    peaks && peaks.length > 0
      ? peaks
      : Array.from({ length: 64 }, (_, i) =>
          Number((0.25 + 0.55 * Math.abs(Math.sin(i * 0.35))).toFixed(2))
        );

  const progressRatio =
    durationSeconds > 0
      ? Math.max(0, Math.min(1, currentTimeSeconds / durationSeconds))
      : 0;

  const ratioFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
  };

  return (
    <div style={{ position: "relative", width: "100%", userSelect: "none" }}>
      {chapters.length > 0 && durationSeconds > 0 && (
        <div style={{ position: "relative", height: 18, marginBottom: 4, width: "100%" }}>
          {chapters.map((ch) => {
            const leftPct = Math.max(0, Math.min(98, (ch.timeSeconds / durationSeconds) * 100));
            return (
              <button
                key={ch.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek?.(ch.timeSeconds);
                }}
                title={`${formatDuration(ch.timeSeconds)} — ${ch.title}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: `${leftPct}%`,
                  transform: "translateX(-50%)",
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "var(--ink)",
                  border: "2px solid var(--card)",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            );
          })}
        </div>
      )}

      <div
        ref={containerRef}
        onMouseMove={(e) => onSeek && setHoverRatio(ratioFromEvent(e))}
        onMouseLeave={() => setHoverRatio(null)}
        onClick={(e) => {
          if (!onSeek || durationSeconds <= 0) return;
          onSeek(Math.round(ratioFromEvent(e) * durationSeconds));
        }}
        style={{
          height,
          display: "flex",
          alignItems: "center",
          gap: 2,
          borderRadius: 10,
          padding: "6px 8px",
          background: "var(--bg)",
          border: compact ? "none" : "2px solid var(--line)",
          cursor: onSeek ? "pointer" : undefined,
          position: "relative",
        }}
        role={onSeek ? "slider" : undefined}
        aria-label={onSeek ? "Audio waveform scrubber" : undefined}
        aria-valuemin={0}
        aria-valuemax={durationSeconds}
        aria-valuenow={Math.round(currentTimeSeconds)}
        tabIndex={onSeek ? 0 : undefined}
        onKeyDown={(e) => {
          if (!onSeek) return;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            onSeek(Math.min(durationSeconds, currentTimeSeconds + 5));
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            onSeek(Math.max(0, currentTimeSeconds - 5));
          }
        }}
      >
        {safePeaks.map((peak, index) => {
          const barRatio = (index + 0.5) / safePeaks.length;
          const isPlayed = barRatio <= progressRatio;
          const isHovered = hoverRatio !== null && barRatio <= hoverRatio && barRatio > progressRatio;
          const barHeightPct = Math.max(14, Math.min(96, Math.round(peak * 95)));
          return (
            <div
              key={index}
              style={{
                height: `${barHeightPct}%`,
                flex: 1,
                minWidth: 2,
                borderRadius: 999,
                background: isPlayed
                  ? "var(--accent)"
                  : isHovered
                    ? "var(--accent)"
                    : "var(--line)",
                opacity: isPlayed ? (isPlaying ? 1 : 0.85) : isHovered ? 0.4 : 1,
              }}
            />
          );
        })}

        {hoverRatio !== null && onSeek && durationSeconds > 0 && (
          <div
            style={{
              position: "absolute",
              top: -34,
              left: `${Math.max(8, Math.min(92, hoverRatio * 100))}%`,
              transform: "translateX(-50%)",
              background: "var(--ink)",
              color: "var(--bg)",
              borderRadius: 6,
              padding: "2px 8px",
              fontSize: 14,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            {formatDuration(Math.round(hoverRatio * durationSeconds))}
          </div>
        )}
      </div>
    </div>
  );
}
