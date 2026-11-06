import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { HttpsProxyAgent } from "https-proxy-agent";
import { db, ensureSchema } from "./db";
import { generateDeterministicWaveformPeaks } from "./audio-synthesis";

// ── Studio podcast platform ────────────────────────────────────────────────
// Ported from the standalone CastForge-style podcast audio extraction app
// into Universe56's Studio app. Adaptations from the source app:
//   - drizzle/pg + per-user auth severed; data lives in the `studio` Postgres
//     schema via the shared @neondatabase/serverless helper (raw SQL).
//   - Extracted WAV bytes are NOT stored as base64 in Postgres (source app
//     did that); they go to Neon Object Storage under the `studio/` prefix
//     and the row keeps storage_key + audio_url (the stream route path).
//   - The episode generator is fully deterministic template logic — it makes
//     NO external AI calls (verified in the source: pure string templating).

// ── Shared types (were @/db/schema in the source app) ──────────────────────
export interface EpisodeChapter {
  id: string;
  timeSeconds: number;
  title: string;
  summary?: string;
}

export interface TranscriptSegment {
  id: string;
  startSeconds: number;
  endSeconds: number;
  speaker: string;
  text: string;
}

// ── Episode generator (ported from src/lib/episode-generator.ts) ───────────
export type EpisodeStyle =
  | "Solo Creator Deep Dive"
  | "Interview & Q&A Breakdown"
  | "Weekly Tech & Product Roundup"
  | "Narrative Story & Lessons";

export interface GenerateEpisodeInput {
  trackTitle: string;
  sourceVideoName: string;
  sourcePlatform: string;
  speakerLabel: string;
  durationSeconds: number;
  lufsLoudness: number;
  customTitle?: string;
  episodeStyle: EpisodeStyle;
  masteringPreset: string;
  includeIntroOutro: boolean;
  focusNotes?: string;
  episodeNumber: number;
}

export interface GeneratedEpisodeOutput {
  title: string;
  subtitle: string;
  summary: string;
  showNotesMarkdown: string;
  chapters: EpisodeChapter[];
  transcript: TranscriptSegment[];
  tags: string[];
  coverImage: string;
  durationSeconds: number;
}

const COVER_IMAGES = [
  "/images/ep-cover-1.png",
  "/images/ep-cover-2.png",
  "/images/ep-cover-3.png",
  "/images/show-cover.png",
];

function extractTopicKeywords(title: string, focusNotes?: string): string[] {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "into", "that", "this", "your",
    "how", "why", "what", "when", "raw", "video", "clip", "audio", "take", "ep",
  ]);
  const combined = `${title} ${focusNotes ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");
  const words = combined
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
  const unique = Array.from(new Set(words)).slice(0, 5);
  if (unique.length < 3) {
    return ["creator-economy", "podcast-production", "audio-storytelling", "workflow"];
  }
  return unique.map((w) => w.replace(/\s+/g, "-"));
}

export function generatePodcastEpisodeContent(
  input: GenerateEpisodeInput
): GeneratedEpisodeOutput {
  const cleanTopic = input.trackTitle
    .replace(/^(Ep\s*\d+\s*[-—:]?\s*)/i, "")
    .replace(/\b(Raw Camera Audio|Clip|Take\s*\d+)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const finalTitle =
    input.customTitle?.trim() ||
    (input.episodeStyle === "Interview & Q&A Breakdown"
      ? `${cleanTopic}: Inside the Creator Playbook`
      : input.episodeStyle === "Weekly Tech & Product Roundup"
        ? `Creator Dispatch: ${cleanTopic}`
        : cleanTopic);

  const totalDur = Math.max(
    30,
    input.durationSeconds + (input.includeIntroOutro ? 8 : 0)
  );

  const focusClause = input.focusNotes?.trim()
    ? ` Special focus on ${input.focusNotes.trim().replace(/\.$/, "")}.`
    : "";

  const subtitle = `Adapted from ${input.sourcePlatform} (${input.sourceVideoName}) • Mastered with ${input.masteringPreset}`;

  const summary = `In Episode ${input.episodeNumber}, ${input.speakerLabel} unpacks ${cleanTopic.toLowerCase()}—breaking down actionable creator systems, production decisions, and audience retention insights originally captured on video and mastered for pure audio listening.${focusClause}`;

  const chapterTemplates = [
    {
      ratio: 0,
      title: input.includeIntroOutro
        ? "Studio Intro & Cold Open Hook"
        : "Cold Open & Topic Framing",
      summary: `Setting the stage for ${cleanTopic} and why it matters for modern creators.`,
    },
    {
      ratio: 0.18,
      title: "The Core Bottleneck Creators Face",
      summary:
        "Diagnosing the friction points in traditional video-first production workflows.",
    },
    {
      ratio: 0.44,
      title: `Deep Dive: ${cleanTopic.slice(0, 42)}`,
      summary:
        "Step-by-step breakdown of the architecture, gear, and editorial structure.",
    },
    {
      ratio: 0.72,
      title: "Real-World Numbers & Listener Retention",
      summary:
        "Measuring completion rates, audio mastering clarity, and cross-platform growth.",
    },
    {
      ratio: 0.88,
      title: "Actionable Playbook & Episode Wrap-Up",
      summary:
        "Three immediate steps listeners can apply to their next recording session.",
    },
  ];

  const chapters: EpisodeChapter[] = chapterTemplates.map((tpl, idx) => ({
    id: `ch-${Date.now()}-${idx + 1}`,
    timeSeconds: Math.min(totalDur - 5, Math.round(totalDur * tpl.ratio)),
    title: tpl.title,
    summary: tpl.summary,
  }));

  const speakers = input.speakerLabel
    .split(/&|,|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const primarySpeaker = speakers[0] || "Host";
  const secondarySpeaker = speakers[1] || primarySpeaker;

  const segmentTemplates = [
    {
      speaker: primarySpeaker,
      text: `Welcome back to the show. Today we're diving straight into ${cleanTopic}. This started as a raw video session (${input.sourceVideoName}), and the ideas we uncovered deserve a dedicated deep-dive audio episode.`,
    },
    {
      speaker: secondarySpeaker,
      text:
        speakers.length > 1
          ? `What surprised me most when we recorded this was how much clarity you gain when you strip away visual distractions and focus purely on the narrative pacing.`
          : `When most creators record video first, they treat audio as an afterthought—yet over 68% of long-form audience time happens with the screen locked in someone's pocket.`,
    },
    {
      speaker: primarySpeaker,
      text: input.focusNotes?.trim()
        ? `Specifically looking at ${input.focusNotes.trim()}, the biggest unlock is building a repeatable pipeline: capture once in high-bitrate video, extract clean isolated stems, and structure chapters for skimmable listening.`
        : `The biggest unlock is building a repeatable studio pipeline: capture once on camera, extract clean isolated stems, normalize loudness to -16 LUFS, and structure timestamped chapters.`,
    },
    {
      speaker: secondarySpeaker,
      text:
        speakers.length > 1
          ? `Exactly. Once your audio chain is dialed in, every keynote, product walkthrough, or founder vlog becomes a flagship podcast episode in minutes rather than days.`
          : `Once your audio chain and chapter rhythm are dialed in, every product walkthrough, founder vlog, or tutorial video turns into a broadcast-ready podcast episode in minutes.`,
    },
    {
      speaker: primarySpeaker,
      text: `Check the timestamped chapter markers and full show notes in your podcast player for every resource we mentioned. Thanks for listening—we'll see you in the next episode.`,
    },
  ];

  const segCount = segmentTemplates.length;
  const transcript: TranscriptSegment[] = segmentTemplates.map((seg, idx) => {
    const startSeconds = Math.round((totalDur / segCount) * idx);
    const endSeconds =
      idx === segCount - 1
        ? totalDur
        : Math.round((totalDur / segCount) * (idx + 1));
    return {
      id: `seg-${Date.now()}-${idx + 1}`,
      startSeconds,
      endSeconds,
      speaker: seg.speaker,
      text: seg.text,
    };
  });

  const tags = extractTopicKeywords(cleanTopic, input.focusNotes);

  const showNotesMarkdown = `### Episode Overview
${summary}

### Key Creator Takeaways
- **Single-Capture Multi-Format Workflow:** Repurposed directly from \`${input.sourceVideoName}\` (${input.sourcePlatform}) without re-recording.
- **Broadcast Audio Mastering:** Processed with **${input.masteringPreset}** (source loudness measured at \`${input.lufsLoudness} LUFS\`).
- **Listener Navigation:** Includes ${chapters.length} timestamped chapter markers and full speaker-diarized transcript.
${input.focusNotes?.trim() ? `- **Creator Focus Highlight:** ${input.focusNotes.trim()}\n` : ""}
### Chapters & Timestamps
${chapters
  .map((c) => {
    const mins = Math.floor(c.timeSeconds / 60);
    const secs = c.timeSeconds % 60;
    const tc = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `- **${tc}** — ${c.title}`;
  })
  .join("\n")}

### Production Credits
- **Host / Speakers:** ${input.speakerLabel}
- **Format Style:** ${input.episodeStyle}
- **Engineered with:** Universe56 Studio`;

  const coverImage =
    COVER_IMAGES[(input.episodeNumber - 1) % COVER_IMAGES.length] ??
    "/images/ep-cover-1.png";

  return {
    title: finalTitle,
    subtitle,
    summary,
    showNotesMarkdown,
    chapters,
    transcript,
    tags,
    coverImage,
    durationSeconds: totalDur,
  };
}

// ── Studio podcast tables (idempotent DDL, studio schema only) ────────────
// Field mapping from the source app's drizzle schema:
//   podcast_shows           -> studio.shows    (user_id dropped — single owner)
//   podcast_episodes        -> studio.episodes (source_track_id -> audio_track_id,
//                                               summary stored in `description`)
//   extracted_audio_tracks  -> studio.audio_tracks (audio_base64 column dropped —
//                                               bytes live in Object Storage)
export async function ensureStudioPodcastTables(): Promise<void> {
  await ensureSchema("studio");
  const sql = db();
  await sql.query(`CREATE TABLE IF NOT EXISTS studio.shows (
    id serial PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    author text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await sql.query(`CREATE TABLE IF NOT EXISTS studio.audio_tracks (
    id serial PRIMARY KEY,
    title text NOT NULL,
    source_type text NOT NULL DEFAULT 'upload',
    source_video_name text NOT NULL,
    source_video_url text,
    source_platform text NOT NULL DEFAULT 'Local Video',
    format text NOT NULL DEFAULT 'WAV',
    sample_rate int NOT NULL DEFAULT 48000,
    bitrate_kbps int NOT NULL DEFAULT 320,
    channels int NOT NULL DEFAULT 2,
    duration_seconds int NOT NULL DEFAULT 0,
    file_size_bytes bigint NOT NULL DEFAULT 0,
    lufs_loudness numeric NOT NULL DEFAULT -16.0,
    noise_reduction boolean NOT NULL DEFAULT true,
    voice_isolation boolean NOT NULL DEFAULT true,
    speaker_label text NOT NULL DEFAULT 'Host',
    notes text NOT NULL DEFAULT '',
    waveform_peaks jsonb NOT NULL DEFAULT '[]'::jsonb,
    audio_url text,
    storage_key text,
    status text NOT NULL DEFAULT 'ready',
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await sql.query(`CREATE TABLE IF NOT EXISTS studio.episodes (
    id serial PRIMARY KEY,
    show_id int REFERENCES studio.shows(id) ON DELETE SET NULL,
    audio_track_id int REFERENCES studio.audio_tracks(id) ON DELETE SET NULL,
    episode_number int NOT NULL DEFAULT 1,
    title text NOT NULL,
    subtitle text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    show_notes_markdown text NOT NULL DEFAULT '',
    cover_image text NOT NULL DEFAULT '',
    duration_seconds int NOT NULL DEFAULT 0,
    chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
    transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
    tags jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'draft',
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await sql.query(`CREATE INDEX IF NOT EXISTS episodes_show_idx ON studio.episodes (show_id)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS episodes_status_idx ON studio.episodes (status)`);
}

// ── Seed: exactly ONE show, idempotent. No episodes are ever seeded. ───────
export const SEEDED_SHOW = {
  slug: "mobile-oil-change-podcast",
  title: "The Mobile Oil Change Podcast",
  author: "Tyreese Burton",
  description:
    "The Mobile Oil Change Podcast — real talk on building a mobile oil change business: fleet accounts, systems, content, and lessons from the road. Hosted by Tyreese Burton of MOMS Mobile Oil Change, Ambler, PA.",
} as const;

export async function seedPodcastShow(): Promise<void> {
  await ensureStudioPodcastTables();
  const sql = db();
  await sql.query(
    `INSERT INTO studio.shows (slug, title, description, author)
     SELECT $1, $2, $3, $4
     WHERE NOT EXISTS (SELECT 1 FROM studio.shows WHERE slug = $1)`,
    [SEEDED_SHOW.slug, SEEDED_SHOW.title, SEEDED_SHOW.description, SEEDED_SHOW.author]
  );
}

// ── Row mappers (DB snake_case -> API camelCase, mirroring the source app) ─
function toShow(r: any) {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    author: r.author,
    hostName: r.author,
    createdAt: r.created_at,
  };
}

function toTrack(r: any) {
  return {
    id: r.id,
    title: r.title,
    sourceType: r.source_type,
    sourceVideoName: r.source_video_name,
    sourceVideoUrl: r.source_video_url,
    sourcePlatform: r.source_platform,
    format: r.format,
    sampleRate: r.sample_rate,
    bitrateKbps: r.bitrate_kbps,
    channels: r.channels,
    durationSeconds: r.duration_seconds,
    fileSizeBytes: Number(r.file_size_bytes),
    lufsLoudness: Number(r.lufs_loudness),
    noiseReduction: r.noise_reduction,
    voiceIsolation: r.voice_isolation,
    speakerLabel: r.speaker_label,
    notes: r.notes,
    waveformPeaks: Array.isArray(r.waveform_peaks) ? r.waveform_peaks : [],
    audioUrl: r.audio_url,
    storageKey: r.storage_key,
    // True when real extracted audio bytes exist in Object Storage.
    hasCustomAudio: Boolean(r.storage_key),
    status: r.status,
    createdAt: r.created_at,
  };
}

function toEpisode(r: any) {
  return {
    id: r.id,
    showId: r.show_id,
    audioTrackId: r.audio_track_id,
    sourceTrackId: r.audio_track_id,
    episodeNumber: r.episode_number,
    title: r.title,
    subtitle: r.subtitle,
    summary: r.description,
    description: r.description,
    showNotesMarkdown: r.show_notes_markdown,
    coverImage: r.cover_image,
    durationSeconds: r.duration_seconds,
    chapters: Array.isArray(r.chapters) ? r.chapters : [],
    transcript: Array.isArray(r.transcript) ? r.transcript : [],
    tags: Array.isArray(r.tags) ? r.tags : [],
    status: r.status,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── API shapes returned to the client (mirror the mappers below) ───────────
export interface StudioShow {
  id: number;
  slug: string;
  title: string;
  description: string;
  author: string;
  hostName: string;
  createdAt: string;
}

export interface StudioTrack {
  id: number;
  title: string;
  sourceType: string;
  sourceVideoName: string;
  sourceVideoUrl: string | null;
  sourcePlatform: string;
  format: string;
  sampleRate: number;
  bitrateKbps: number;
  channels: number;
  durationSeconds: number;
  fileSizeBytes: number;
  lufsLoudness: number;
  noiseReduction: boolean;
  voiceIsolation: boolean;
  speakerLabel: string;
  notes: string;
  waveformPeaks: number[];
  audioUrl: string | null;
  storageKey: string | null;
  hasCustomAudio: boolean;
  status: string;
  createdAt: string;
}

export interface StudioEpisode {
  id: number;
  showId: number | null;
  audioTrackId: number | null;
  sourceTrackId: number | null;
  episodeNumber: number;
  title: string;
  subtitle: string;
  summary: string;
  description: string;
  showNotesMarkdown: string;
  coverImage: string;
  durationSeconds: number;
  chapters: EpisodeChapter[];
  transcript: TranscriptSegment[];
  tags: string[];
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Shows ──────────────────────────────────────────────────────────────────
export async function getShowBySlug(slug: string) {
  await ensureStudioPodcastTables();
  const sql = db();
  const rows: any[] = await sql.query(`SELECT * FROM studio.shows WHERE slug = $1`, [slug]);
  return rows.length ? toShow(rows[0]) : null;
}

export async function getSeededShow() {
  await seedPodcastShow();
  return getShowBySlug(SEEDED_SHOW.slug);
}

// ── Object Storage (Neon S3, studio/ prefix) ───────────────────────────────
// Client construction mirrors src/app/api/neon/storage-test/route.ts,
// including the explicit egress-proxy agent the sandbox requires.
function s3Client() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const requestHandler = proxy
    ? new NodeHttpHandler({ httpsAgent: new HttpsProxyAgent(proxy) })
    : undefined;
  return new S3Client({
    requestHandler,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    region: process.env.AWS_REGION || "us-east-2",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

function storageConfigured(): boolean {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.AWS_ENDPOINT_URL_S3 &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
  );
}

export async function putStudioAudio(key: string, bytes: Buffer): Promise<void> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET not configured");
  await s3Client().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: "audio/wav" })
  );
}

export async function getStudioAudio(key: string): Promise<Buffer> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET not configured");
  const got = await s3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const c of got.Body as AsyncIterable<Uint8Array>) chunks.push(c);
  return Buffer.concat(chunks);
}

// ── Audio tracks ───────────────────────────────────────────────────────────
export async function listTracks() {
  await ensureStudioPodcastTables();
  const sql = db();
  const rows: any[] = await sql.query(`SELECT * FROM studio.audio_tracks ORDER BY created_at DESC, id DESC`);
  return rows.map(toTrack);
}

export async function getTrack(id: number) {
  await ensureStudioPodcastTables();
  const sql = db();
  const rows: any[] = await sql.query(`SELECT * FROM studio.audio_tracks WHERE id = $1`, [id]);
  return rows.length ? toTrack(rows[0]) : null;
}

export async function getTrackRow(id: number) {
  await ensureStudioPodcastTables();
  const sql = db();
  const rows: any[] = await sql.query(`SELECT * FROM studio.audio_tracks WHERE id = $1`, [id]);
  return rows.length ? rows[0] : null;
}

function detectPlatformFromUrl(url: string): {
  platform: string;
  derivedFilename: string;
  derivedTitle: string;
} {
  const lower = url.toLowerCase();
  let platform = "Direct Video URL";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) platform = "YouTube";
  else if (lower.includes("loom.com")) platform = "Loom";
  else if (lower.includes("vimeo.com")) platform = "Vimeo";
  else if (lower.includes("tiktok.com")) platform = "TikTok";
  else if (lower.includes("instagram.com")) platform = "Instagram Reel";

  let slugPart = "creator-video-stream";
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const lastSeg = segments[segments.length - 1];
    const vParam = parsed.searchParams.get("v");
    if (lastSeg && lastSeg !== "watch") slugPart = lastSeg.replace(/\.[^/.]+$/, "");
    else if (vParam) slugPart = `${platform.toLowerCase()}-${vParam}`;
  } catch {
    // Keep fallback slug
  }

  const cleanTitle = slugPart
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    platform,
    derivedFilename: `${slugPart}.mp4`,
    derivedTitle: `${platform} Extract — ${cleanTitle || "Creator Session"}`,
  };
}

export interface CreateTrackInput {
  title?: string;
  sourceType?: "upload" | "url" | "sample";
  sourceVideoName?: string;
  sourceVideoUrl?: string | null;
  sourcePlatform?: string;
  format?: "WAV" | "MP3" | "AAC";
  sampleRate?: number;
  bitrateKbps?: number;
  channels?: number;
  durationSeconds?: number;
  fileSizeBytes?: number;
  lufsLoudness?: number;
  noiseReduction?: boolean;
  voiceIsolation?: boolean;
  speakerLabel?: string;
  notes?: string;
  waveformPeaks?: number[];
  audioBase64?: string | null;
}

// Creates a track row. When audioBase64 is present, the decoded WAV bytes are
// uploaded to Object Storage under studio/podcast/ and audio_url is set to
// the stream route. If the upload fails (or storage is unconfigured), the
// track metadata is still saved with audio_url null — reported, never faked.
export async function createTrack(input: CreateTrackInput) {
  await ensureStudioPodcastTables();
  const sourceType = input.sourceType ?? "upload";
  if (sourceType === "url" && !input.sourceVideoUrl) {
    throw new Error("A video URL is required when importing from URL");
  }
  const urlInfo = input.sourceVideoUrl ? detectPlatformFromUrl(input.sourceVideoUrl) : null;
  const sourcePlatform =
    input.sourcePlatform ?? urlInfo?.platform ?? (sourceType === "sample" ? "Studio Clip" : "Local Video");
  const sourceVideoName = input.sourceVideoName ?? urlInfo?.derivedFilename ?? "studio_video_capture.mp4";
  const title =
    input.title?.trim() ||
    urlInfo?.derivedTitle ||
    sourceVideoName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");

  let durationSeconds = input.durationSeconds;
  if (!durationSeconds) {
    let hash = 0;
    const seedStr = input.sourceVideoUrl || sourceVideoName || title;
    for (let i = 0; i < seedStr.length; i++) hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    durationSeconds = 110 + (hash % 240);
  }
  const format = input.format ?? "WAV";
  const sampleRate = input.sampleRate ?? 48000;
  const channels = input.channels ?? 2;
  const bitrateKbps = input.bitrateKbps ?? (format === "WAV" ? 1536 : format === "MP3" ? 320 : 256);
  const fileSizeBytes = input.fileSizeBytes ?? Math.round((durationSeconds * bitrateKbps * 1000) / 8);
  const lufsLoudness = input.lufsLoudness ?? (input.voiceIsolation === false ? -17.4 : -16.0);
  const waveformPeaks =
    input.waveformPeaks ??
    generateDeterministicWaveformPeaks(`${title}-${sourceVideoName}-${durationSeconds}`, 72);

  // Upload extracted audio bytes to Object Storage when provided.
  let storageKey: string | null = null;
  let storageError: string | null = null;
  if (input.audioBase64 && input.audioBase64.length > 0) {
    if (storageConfigured()) {
      try {
        const bytes = Buffer.from(input.audioBase64, "base64");
        const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "track";
        storageKey = `studio/podcast/${Date.now()}-${safeName}.wav`;
        await putStudioAudio(storageKey, bytes);
      } catch (e: any) {
        storageKey = null;
        storageError = String(e?.name || e?.message || e).slice(0, 200);
      }
    } else {
      storageError = "Object Storage env not configured; metadata saved without audio bytes.";
    }
  }

  const sql = db();
  const rows: any[] = await sql.query(
    `INSERT INTO studio.audio_tracks
       (title, source_type, source_video_name, source_video_url, source_platform, format,
        sample_rate, bitrate_kbps, channels, duration_seconds, file_size_bytes, lufs_loudness,
        noise_reduction, voice_isolation, speaker_label, notes, waveform_peaks, audio_url, storage_key, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,'ready')
     RETURNING *`,
    [
      title,
      sourceType,
      sourceVideoName,
      input.sourceVideoUrl ?? null,
      sourcePlatform,
      format,
      sampleRate,
      bitrateKbps,
      channels,
      durationSeconds,
      fileSizeBytes,
      lufsLoudness,
      input.noiseReduction ?? true,
      input.voiceIsolation ?? true,
      input.speakerLabel ?? SEEDED_SHOW.author,
      input.notes ?? `Extracted from ${sourcePlatform} (${sourceVideoName}) at ${sampleRate / 1000}kHz ${format}.`,
      JSON.stringify(waveformPeaks),
      null, // audio_url is set below once the row id exists (stream route path)
      storageKey,
    ]
  );
  const track = toTrack(rows[0]);
  if (storageKey) {
    track.audioUrl = `/api/studio/podcast/audio-stream/${track.id}`;
    await sql.query(`UPDATE studio.audio_tracks SET audio_url = $1 WHERE id = $2`, [track.audioUrl, track.id]);
  }
  return { track, storageError };
}

// ── Episodes ───────────────────────────────────────────────────────────────
export async function listEpisodes() {
  await ensureStudioPodcastTables();
  const sql = db();
  const rows: any[] = await sql.query(
    `SELECT * FROM studio.episodes ORDER BY episode_number DESC, created_at DESC`
  );
  return rows.map(toEpisode);
}

export async function getEpisode(id: number) {
  await ensureStudioPodcastTables();
  const sql = db();
  const rows: any[] = await sql.query(`SELECT * FROM studio.episodes WHERE id = $1`, [id]);
  return rows.length ? toEpisode(rows[0]) : null;
}

export async function nextEpisodeNumber(): Promise<number> {
  const sql = db();
  const rows: any[] = await sql.query(
    `SELECT COALESCE(MAX(episode_number), 0)::int AS max_num FROM studio.episodes`
  );
  return (rows[0]?.max_num ?? 0) + 1;
}

export interface CreateEpisodeInput {
  // { action: "generate", topic } path
  action?: string;
  topic?: string;
  // Source-app create/generate path
  sourceTrackId?: number | null;
  audioTrackId?: number | null;
  customTitle?: string;
  title?: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  showNotesMarkdown?: string;
  episodeStyle?: EpisodeStyle;
  masteringPreset?: string;
  includeIntroOutro?: boolean;
  focusNotes?: string;
  episodeNumber?: number;
  status?: "draft" | "published";
  chapters?: EpisodeChapter[];
  transcript?: TranscriptSegment[];
  tags?: string[];
  coverImage?: string;
}

const EPISODE_STYLES: EpisodeStyle[] = [
  "Solo Creator Deep Dive",
  "Interview & Q&A Breakdown",
  "Weekly Tech & Product Roundup",
  "Narrative Story & Lessons",
];

// Creates an episode. The generator is deterministic template logic (no
// external AI call) — it fills any field the caller didn't supply, exactly
// like the source app's POST /api/episodes.
export async function createEpisode(input: CreateEpisodeInput) {
  const show = await getSeededShow();
  if (!show) throw new Error("podcast show is not seeded");
  const sql = db();

  const trackId = input.audioTrackId ?? input.sourceTrackId ?? null;
  let track: any = null;
  if (trackId) {
    track = await getTrack(trackId);
    if (!track) throw new Error("Referenced extracted audio track not found");
  }

  const episodeNumber = input.episodeNumber ?? (await nextEpisodeNumber());
  const style: EpisodeStyle =
    input.episodeStyle && EPISODE_STYLES.includes(input.episodeStyle)
      ? input.episodeStyle
      : "Solo Creator Deep Dive";
  const masteringPreset = input.masteringPreset ?? "Broadcast Voice (-16 LUFS)";
  const includeIntroOutro = input.includeIntroOutro ?? true;

  const generated = generatePodcastEpisodeContent({
    trackTitle:
      track?.title ??
      input.topic ??
      input.title ??
      input.customTitle ??
      `Studio Session #${episodeNumber}`,
    sourceVideoName: track?.sourceVideoName ?? "studio_master_recording.mp4",
    sourcePlatform: track?.sourcePlatform ?? (input.topic ? "Studio Topic" : "Local Studio"),
    speakerLabel: track?.speakerLabel ?? show.author,
    durationSeconds: track?.durationSeconds ?? (input.topic ? 300 : 210),
    lufsLoudness: track?.lufsLoudness ?? -16,
    customTitle: input.customTitle ?? input.title,
    episodeStyle: style,
    masteringPreset,
    includeIntroOutro,
    focusNotes: input.focusNotes,
    episodeNumber,
  });

  const status = input.action === "generate" ? "draft" : input.status === "published" ? "published" : "draft";
  const summary = input.summary?.trim() || input.description?.trim() || generated.summary;

  const rows: any[] = await sql.query(
    `INSERT INTO studio.episodes
       (show_id, audio_track_id, episode_number, title, subtitle, description,
        show_notes_markdown, cover_image, duration_seconds, chapters, transcript,
        tags, status, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14)
     RETURNING *`,
    [
      show.id,
      track?.id ?? null,
      episodeNumber,
      input.title?.trim() || generated.title,
      input.subtitle?.trim() || generated.subtitle,
      summary,
      input.showNotesMarkdown?.trim() || generated.showNotesMarkdown,
      input.coverImage || generated.coverImage,
      generated.durationSeconds,
      JSON.stringify(input.chapters ?? generated.chapters),
      JSON.stringify(input.transcript ?? generated.transcript),
      JSON.stringify(input.tags ?? generated.tags),
      status,
      status === "published" ? new Date().toISOString() : null,
    ]
  );
  return toEpisode(rows[0]);
}

export interface UpdateEpisodeInput {
  title?: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  showNotesMarkdown?: string;
  episodeNumber?: number;
  audioTrackId?: number | null;
  sourceTrackId?: number | null;
  chapters?: EpisodeChapter[];
  transcript?: TranscriptSegment[];
  tags?: string[];
  status?: "draft" | "published";
  coverImage?: string;
  durationSeconds?: number;
}

export async function updateEpisode(id: number, input: UpdateEpisodeInput) {
  await ensureStudioPodcastTables();
  const sql = db();
  const sets: string[] = ["updated_at = now()"];
  const params: any[] = [];
  const push = (col: string, val: any, cast = "") => {
    params.push(val);
    sets.push(`${col} = $${params.length}${cast}`);
  };
  if (input.title !== undefined) push("title", input.title);
  if (input.subtitle !== undefined) push("subtitle", input.subtitle);
  const summary = input.summary ?? input.description;
  if (summary !== undefined) push("description", summary);
  if (input.showNotesMarkdown !== undefined) push("show_notes_markdown", input.showNotesMarkdown);
  if (input.episodeNumber !== undefined) push("episode_number", input.episodeNumber);
  const trackId = input.audioTrackId ?? input.sourceTrackId;
  if (trackId !== undefined) push("audio_track_id", trackId);
  if (input.chapters !== undefined) push("chapters", JSON.stringify(input.chapters), "::jsonb");
  if (input.transcript !== undefined) push("transcript", JSON.stringify(input.transcript), "::jsonb");
  if (input.tags !== undefined) push("tags", JSON.stringify(input.tags), "::jsonb");
  if (input.coverImage !== undefined) push("cover_image", input.coverImage);
  if (input.durationSeconds !== undefined) push("duration_seconds", input.durationSeconds);
  if (input.status !== undefined) {
    push("status", input.status);
    if (input.status === "published") sets.push("published_at = COALESCE(published_at, now())");
  }
  params.push(id);
  const rows: any[] = await sql.query(
    `UPDATE studio.episodes SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows.length ? toEpisode(rows[0]) : null;
}

export async function deleteEpisode(id: number): Promise<boolean> {
  await ensureStudioPodcastTables();
  const sql = db();
  const rows: any[] = await sql.query(`DELETE FROM studio.episodes WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}

export async function listPublishedEpisodesWithTracks(showId: number) {
  await ensureStudioPodcastTables();
  const sql = db();
  const rows: any[] = await sql.query(
    `SELECT e.*, t.file_size_bytes AS track_file_size_bytes
     FROM studio.episodes e
     LEFT JOIN studio.audio_tracks t ON t.id = e.audio_track_id
     WHERE e.show_id = $1 AND e.status = 'published'
     ORDER BY e.episode_number DESC`,
    [showId]
  );
  return rows;
}
