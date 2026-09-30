import { writeFileSync } from "node:fs";

// Deterministic stand-in for TTS speech: a few-harmonic voiced tone with a
// wandering f0 under a syllable envelope, phrase pauses, and a short plosive
// burst at most syllable onsets. Like real speech (the failing production
// take sat 18.9 dB above its loudness), sparse transients put the true peak
// far above the integrated loudness, so linear gain alone cannot reach
// -16 LUFS under -1 dBTP. 24 kHz mono 16-bit, the shape hosted TTS returns.
export function writeSpeechLikeWav(
  path: string,
  options: { seconds: number; harmonics?: number; burstGain?: number },
): void {
  const sampleRate = 24000;
  const harmonics = options.harmonics ?? 6;
  const burstGain = options.burstGain ?? 4;
  const count = Math.round(sampleRate * options.seconds);
  const pcm = new Int16Array(count);
  let phase = 0;
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate;
    const f0 =
      120 +
      15 * Math.sin(2 * Math.PI * 0.7 * t) +
      8 * Math.sin(2 * Math.PI * 3.1 * t);
    phase += (2 * Math.PI * f0) / sampleRate;
    let sample = 0;
    for (let h = 1; h <= harmonics; h++)
      sample += Math.sin(h * phase) / Math.sqrt(h);
    const syllable = Math.max(0, Math.sin(2 * Math.PI * 4.2 * t)) ** 0.6;
    const phrase = t % 4 < 3 ? 1 : 0;
    const stress = 0.55 + 0.45 * Math.abs(Math.sin(2 * Math.PI * 0.37 * t));
    // A 6 ms decaying 3.3 kHz burst at the start of three syllables in four.
    const syllableTime = t % (1 / 4.2);
    const syllableIndex = Math.floor(t * 4.2);
    const burst =
      syllableIndex % 4 !== 3 && syllableTime < 0.006
        ? burstGain *
          Math.exp(-syllableTime / 0.0015) *
          Math.sin(2 * Math.PI * 3300 * syllableTime)
        : 0;
    const value = 0.08 * (sample * syllable * stress + burst) * phrase;
    pcm[i] = Math.round(Math.max(-1, Math.min(1, value)) * 32767);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + count * 2, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(count * 2, 40);
  writeFileSync(path, Buffer.concat([header, Buffer.from(pcm.buffer)]));
}
