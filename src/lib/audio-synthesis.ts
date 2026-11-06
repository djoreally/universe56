export function generateDeterministicWaveformPeaks(
  seedText: string,
  bars = 72
): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const nextRand = () => {
    hash += 0x6d2b79f5;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    // Simulate natural speech phrasing & breath pauses every ~14-18 bars
    const phrasePos = (i % 16) / 16;
    const phraseEnvelope =
      phrasePos > 0.86
        ? 0.16 + nextRand() * 0.14
        : 0.35 + Math.sin(phrasePos * Math.PI) * 0.45;
    const syllableJitter = 0.72 + nextRand() * 0.48;
    const raw = phraseEnvelope * syllableJitter;
    const clamped = Math.max(0.1, Math.min(0.98, Number(raw.toFixed(3))));
    peaks.push(clamped);
  }
  return peaks;
}

/**
 * Generates a pleasant, warm studio WAV binary (16-bit PCM, 22050 Hz mono)
 * modulated by the track's waveform peaks so playback is smooth, non-harsh,
 * and visually synchronized with the waveform scrubber.
 */
export function synthesizeStudioWavBuffer(options: {
  seed: number;
  durationSeconds: number;
  waveformPeaks: number[];
  voiceIsolation?: boolean;
}): Buffer {
  const sampleRate = 22050;
  // Cap synthesized buffer at 45s for fast HTTP streaming while preserving full PCM header integrity
  const effectiveDuration = Math.max(3, Math.min(45, options.durationSeconds));
  const numSamples = Math.floor(sampleRate * effectiveDuration);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM
  buffer.writeUInt16LE(1, 20); // AudioFormat = 1
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const peaks =
    options.waveformPeaks.length > 0 ? options.waveformPeaks : [0.5, 0.7, 0.4];
  const baseScale = ((options.seed % 5) + 1) * 0.04;
  // Warm studio chord frequencies (Fmaj9 / Cmaj9 vocal warmth range)
  const f1 = 146.83 * (1 + baseScale); // Warm baritone fundamental (~D3-E3)
  const f2 = f1 * 1.5; // Fifth
  const f3 = f1 * 2.25; // Ninth harmonic warmth

  const fadeSamples = Math.floor(sampleRate * 0.35);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;
    const peakIndex = Math.min(
      peaks.length - 1,
      Math.floor(progress * peaks.length)
    );
    const envelope = peaks[peakIndex] ?? 0.5;

    // Gentle speech-like syllabic cadence (3.8 Hz modulation)
    const cadence = 0.65 + 0.35 * Math.sin(2 * Math.PI * 3.8 * t);
    const slowShift = 1 + 0.08 * Math.sin(2 * Math.PI * 0.25 * t);

    const wave =
      0.55 * Math.sin(2 * Math.PI * f1 * slowShift * t) +
      0.28 * Math.sin(2 * Math.PI * f2 * t) +
      0.17 * Math.sin(2 * Math.PI * f3 * t);

    let fade = 1.0;
    if (i < fadeSamples) {
      fade = i / fadeSamples;
    } else if (i > numSamples - fadeSamples) {
      fade = (numSamples - i) / fadeSamples;
    }

    const amplitude = options.voiceIsolation ? 0.34 : 0.28;
    const sampleFloat = wave * envelope * cadence * fade * amplitude;
    const sampleInt = Math.max(
      -32767,
      Math.min(32767, Math.round(sampleFloat * 32767))
    );
    buffer.writeInt16LE(sampleInt, 44 + i * 2);
  }

  return buffer;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0"
    )}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
