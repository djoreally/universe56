"use client";

// Ported from the standalone podcast app (components/VideoExtractionDeck.tsx).
// Extraction logic unchanged (real in-browser Web Audio extraction via
// @/lib/video-audio-extractor); saves go to the Universe56 Studio API
// (/api/studio/podcast/audio-tracks), styling adapted to Universe56, and the
// source app's demo "Sample Clips" mode (fictional demo videos) was dropped.
import React, { useRef, useState } from "react";
import {
  Upload,
  Link2,
  Film,
  CheckCircle2,
  Loader2,
  Sliders,
  Volume2,
  AlertCircle,
} from "lucide-react";
import type { StudioTrack } from "@/lib/studio-podcast";
import { extractAudioFromVideoFile } from "@/lib/video-audio-extractor";

interface VideoExtractionDeckProps {
  defaultFormat: "WAV" | "MP3" | "AAC";
  defaultSpeaker: string;
  onTrackExtracted: (track: StudioTrack, localBlobUrl?: string | null) => void;
  compact?: boolean;
}

const TRACKS_API = "/api/studio/podcast/audio-tracks";

const tabBtn = (active: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 10,
  padding: "12px 20px",
  fontSize: 19,
  fontWeight: 800,
  cursor: "pointer",
  border: "2px solid var(--line)",
  background: active ? "var(--ink)" : "var(--card)",
  color: active ? "var(--bg)" : "var(--ink)",
});

export function VideoExtractionDeck({
  defaultFormat,
  defaultSpeaker,
  onTrackExtracted,
  compact = false,
}: VideoExtractionDeckProps) {
  const [inputMode, setInputMode] = useState<"upload" | "url">("upload");
  const [format, setFormat] = useState<"WAV" | "MP3" | "AAC">(defaultFormat);
  const [voiceIsolation, setVoiceIsolation] = useState(true);
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [speakerLabel, setSpeakerLabel] = useState(defaultSpeaker);
  const [videoUrl, setVideoUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [extracting, setExtracting] = useState(false);
  const [progressStage, setProgressStage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalFile = async (file: File) => {
    setError(null);
    setSuccessBanner(null);
    setExtracting(true);
    setProgressPercent(10);
    setProgressStage("Initializing Web Audio demuxer...");

    try {
      const extracted = await extractAudioFromVideoFile(file, {
        format,
        voiceIsolation,
        noiseReduction,
        onProgress: (stage, pct) => {
          setProgressStage(stage);
          setProgressPercent(pct);
        },
      });

      setProgressStage("Saving extracted stem to studio library...");
      setProgressPercent(96);

      const res = await fetch(TRACKS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customTitle.trim() || extracted.title,
          sourceType: "upload",
          sourceVideoName: extracted.sourceVideoName,
          sourcePlatform: "Local Video",
          format,
          sampleRate: extracted.sampleRate,
          channels: extracted.channels,
          durationSeconds: extracted.durationSeconds,
          fileSizeBytes: extracted.fileSizeBytes,
          lufsLoudness: extracted.lufsLoudness,
          noiseReduction,
          voiceIsolation,
          speakerLabel: speakerLabel.trim() || defaultSpeaker,
          waveformPeaks: extracted.waveformPeaks,
          audioBase64: extracted.audioBase64,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save extracted audio");
        setExtracting(false);
        return;
      }

      setProgressPercent(100);
      setCustomTitle("");
      setSuccessBanner(
        `Extracted "${data.track.title}" (${format})${data.storageError ? ` — note: audio bytes were not stored (${data.storageError})` : ""}`
      );
      onTrackExtracted(data.track, extracted.localBlobUrl);
    } catch {
      setError("Could not extract audio from this video file");
    } finally {
      setExtracting(false);
    }
  };

  const handleUrlExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) {
      setError("Please enter a valid YouTube, Loom, Vimeo, or MP4 URL");
      return;
    }

    setError(null);
    setSuccessBanner(null);
    setExtracting(true);
    setProgressPercent(25);
    setProgressStage("Fetching video stream metadata...");

    const t1 = window.setTimeout(() => {
      setProgressPercent(65);
      setProgressStage("Demuxing audio stem & computing 72-band waveform...");
    }, 260);

    try {
      const res = await fetch(TRACKS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customTitle.trim() || undefined,
          sourceType: "url",
          sourceVideoUrl: videoUrl.trim(),
          format,
          noiseReduction,
          voiceIsolation,
          speakerLabel: speakerLabel.trim() || defaultSpeaker,
        }),
      });

      window.clearTimeout(t1);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to import video URL");
        setExtracting(false);
        return;
      }

      setProgressPercent(100);
      setVideoUrl("");
      setCustomTitle("");
      setSuccessBanner(`Extracted "${data.track.title}" from URL`);
      onTrackExtracted(data.track, null);
    } catch {
      window.clearTimeout(t1);
      setError("Network error while importing video URL");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Film size={28} /> Video-to-Audio Extraction Deck
          </h3>
          {!compact && (
            <p style={{ margin: 0 }}>
              Drop a local video file (MP4, MOV, WebM) or paste a creator URL.
              Audio is extracted right in your browser, then the WAV is stored
              in Neon Object Storage under the studio/ prefix.
            </p>
          )}
        </div>
        <div style={{ display: "inline-flex", gap: 8 }}>
          <button type="button" onClick={() => setInputMode("upload")} style={tabBtn(inputMode === "upload")}>
            <Upload size={20} /> <span>Video File</span>
          </button>
          <button type="button" onClick={() => setInputMode("url")} style={tabBtn(inputMode === "url")}>
            <Link2 size={20} /> <span>Video URL</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="warn" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={22} /> <span>{error}</span>
        </p>
      )}
      {successBanner && (
        <p className="ok" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={22} /> <span>{successBanner}</span>
        </p>
      )}

      {inputMode === "upload" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile) handleLocalFile(droppedFile);
          }}
          onClick={() => !extracting && fileInputRef.current?.click()}
          style={{
            marginTop: 18,
            border: "3px dashed var(--line)",
            borderColor: isDragging ? "var(--accent)" : "var(--line)",
            borderRadius: 16,
            padding: compact ? "28px 20px" : "44px 20px",
            textAlign: "center",
            cursor: "pointer",
            background: "var(--bg)",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleLocalFile(file);
                e.target.value = "";
              }
            }}
            style={{ display: "none" }}
          />
          <div style={{ display: "flex", justifyContent: "center" }}>
            {extracting ? <Loader2 size={44} /> : <Upload size={44} />}
          </div>
          <p style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>
            {extracting ? progressStage : "Drop a video file here, or click to browse"}
          </p>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Supports MP4, MOV, WebM, MKV, AVI • Real Web Audio PCM extraction &amp; loudness metering
          </p>
        </div>
      )}

      {inputMode === "url" && (
        <form onSubmit={handleUrlExtraction} style={{ marginTop: 18 }}>
          <label>
            Video URL (YouTube, Loom, Vimeo, TikTok, or MP4)
            <input
              type="url"
              required
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=creator-podcast-session"
            />
          </label>
          <label>
            Custom Track Title (optional)
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Auto-detected from URL"
            />
          </label>
          <button type="submit" disabled={extracting} className="bigbtn" style={{ marginTop: 0 }}>
            {extracting ? "Extracting…" : "Extract Audio from URL"}
          </button>
        </form>
      )}

      {extracting && (
        <div style={{ marginTop: 18 }}>
          <p style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, margin: "0 0 8px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={20} /> {progressStage}
            </span>
            <span>{progressPercent}%</span>
          </p>
          <div style={{ height: 12, borderRadius: 999, background: "var(--bg)", border: "2px solid var(--line)", overflow: "hidden" }}>
            <div style={{ width: `${progressPercent}%`, height: "100%", background: "var(--accent)" }} />
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 20,
          paddingTop: 18,
          borderTop: "2px solid var(--line)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800 }}>Format:</span>
          {(["WAV", "MP3", "AAC"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setFormat(fmt)}
              style={{
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 18,
                fontWeight: 800,
                cursor: "pointer",
                border: "2px solid var(--line)",
                background: format === fmt ? "var(--ink)" : "var(--card)",
                color: format === fmt ? "var(--bg)" : "var(--ink)",
              }}
            >
              {fmt}
            </button>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Speaker:
          <input
            type="text"
            value={speakerLabel}
            onChange={(e) => setSpeakerLabel(e.target.value)}
            placeholder="Host Name"
            style={{ width: 220, margin: 0 }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={voiceIsolation}
            onChange={(e) => setVoiceIsolation(e.target.checked)}
            style={{ width: 24, height: 24, margin: 0 }}
          />
          <Volume2 size={20} /> <span>Voice Isolation (-16 LUFS)</span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={noiseReduction}
            onChange={(e) => setNoiseReduction(e.target.checked)}
            style={{ width: 24, height: 24, margin: 0 }}
          />
          <Sliders size={20} /> <span>Denoise</span>
        </label>
      </div>
    </div>
  );
}
