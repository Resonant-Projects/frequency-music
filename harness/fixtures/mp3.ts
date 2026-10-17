// Synthetic MPEG-1 Layer III files for parser and upload tests: real frame
// headers and an optional Xing/Info frame, with silent (constant) payloads.

const BITRATE_INDEX: Record<number, number> = { 128: 9, 256: 13, 320: 14 };
const RATE_INDEX: Record<number, number> = { 44100: 0, 48000: 1, 32000: 2 };
const MODE_INDEX = { stereo: 0, jointStereo: 1, dualChannel: 2, mono: 3 };

export type Mp3FixtureOptions = {
  frames: number;
  bitrateKbps?: number;
  sampleRate?: number;
  mode?: keyof typeof MODE_INDEX;
  info?: {
    encoder: string;
    frames?: number;
    delay?: number;
    padding?: number;
  } | null;
  fill?: number;
  prefix?: Uint8Array;
  suffix?: Uint8Array;
};

function frame(
  bitrateKbps: number,
  sampleRate: number,
  mode: keyof typeof MODE_INDEX,
  fill: number,
): Uint8Array {
  const length = Math.floor((144_000 * bitrateKbps) / sampleRate);
  const bytes = new Uint8Array(length).fill(fill);
  // All-zero side information is a valid, silent granule layout.
  bytes.fill(0, 4, 4 + (mode === "mono" ? 17 : 32));
  bytes[0] = 0xff;
  bytes[1] = 0xfb;
  bytes[2] =
    (BITRATE_INDEX[bitrateKbps]! << 4) | (RATE_INDEX[sampleRate]! << 2);
  bytes[3] = MODE_INDEX[mode] << 6;
  return bytes;
}

export function mp3Fixture(options: Mp3FixtureOptions): Uint8Array {
  const bitrateKbps = options.bitrateKbps ?? 256;
  const sampleRate = options.sampleRate ?? 48000;
  const mode = options.mode ?? "jointStereo";
  const fill = options.fill ?? 0x55;
  const parts: Uint8Array[] = [];
  if (options.prefix) parts.push(options.prefix);
  if (options.info !== null) {
    const info = frame(bitrateKbps, sampleRate, mode, 0);
    const start = 4 + (mode === "mono" ? 17 : 32);
    info.set(new TextEncoder().encode("Info"), start);
    new DataView(info.buffer).setUint32(start + 4, 0x1);
    new DataView(info.buffer).setUint32(
      start + 8,
      options.info?.frames ?? options.frames,
    );
    info.set(
      new TextEncoder().encode(
        (options.info?.encoder ?? "Lavf lame").padEnd(9, "\0"),
      ),
      start + 12,
    );
    // LAME-tag gapless fields 21 bytes after the encoder string.
    const delay = options.info?.delay ?? 576;
    const padding = options.info?.padding ?? 576;
    info.set(
      [delay >> 4, ((delay & 0x0f) << 4) | (padding >> 8), padding & 0xff],
      start + 12 + 21,
    );
    parts.push(info);
  }
  for (let index = 0; index < options.frames; index++)
    parts.push(frame(bitrateKbps, sampleRate, mode, fill));
  if (options.suffix) parts.push(options.suffix);
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
