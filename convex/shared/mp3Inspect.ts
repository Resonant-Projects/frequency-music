// Dependency-free structural check of an MPEG-1 Layer III file. A blind
// comparison member must be bare audio frames, so the file has to parse as
// one contiguous run of identically configured frames from byte 0 to the last
// byte: an ID3, APE or Lyrics tag, junk, or a truncated last frame is refused
// rather than skipped. Each audio frame's side information must also describe
// a decodable granule layout (big_values, block type, bit-reservoir budget).
// The Huffman data itself is not decoded, so loudness is not measured and a
// corrupted payload behind valid side information can still pass.

// MPEG-1 Layer III bitrates (kbps) by header index; 0 is free format, 15 bad.
const BITRATES_KBPS = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const SAMPLE_RATES = [44100, 48000, 32000];
const SAMPLES_PER_FRAME = 1152;
const CHANNEL_MODES = ["stereo", "jointStereo", "dualChannel", "mono"] as const;

export type Mp3ChannelMode = (typeof CHANNEL_MODES)[number];

export type Mp3Inspection = {
  sampleRate: number;
  bitrateKbps: number;
  channels: 1 | 2;
  channelMode: Mp3ChannelMode;
  /** Audio frames, excluding a leading Xing/Info frame. */
  audioFrames: number;
  /** Frame count times 1152 samples, encoder delay and padding included. */
  durationSecs: number;
  /** The leading Xing or Info frame an encoder writes, if any. */
  infoFrame: {
    tag: "Xing" | "Info";
    frames?: number;
    /** The 9-byte encoder string after the Xing fields (e.g. "Lavc"). */
    encoder?: string;
  } | null;
};

export class Mp3InspectionError extends Error {}

type FrameHeader = {
  bitrateKbps: number;
  sampleRate: number;
  channelMode: Mp3ChannelMode;
  padding: number;
  crc: boolean;
  length: number;
};

function header(bytes: Uint8Array, offset: number): FrameHeader | null {
  if (offset + 4 > bytes.length) return null;
  const b1 = bytes[offset + 1]!;
  const b2 = bytes[offset + 2]!;
  const b3 = bytes[offset + 3]!;
  // 11 sync bits, version 11 (MPEG-1), layer 01 (Layer III).
  if (bytes[offset] !== 0xff || (b1 & 0xfe) !== 0xfa) return null;
  const bitrateKbps = BITRATES_KBPS[b2 >> 4]!;
  const sampleRate = SAMPLE_RATES[(b2 >> 2) & 0x03];
  if (!bitrateKbps || !sampleRate) return null;
  const padding = (b2 >> 1) & 0x01;
  return {
    bitrateKbps,
    sampleRate,
    channelMode: CHANNEL_MODES[b3 >> 6]!,
    padding,
    // Protection bit 0 means a 16-bit CRC follows the header.
    crc: (b1 & 0x01) === 0,
    length: Math.floor((144_000 * bitrateKbps) / sampleRate) + padding,
  };
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

class BitReader {
  private bit = 0;
  constructor(
    private readonly bytes: Uint8Array,
    private readonly start: number,
  ) {}
  read(count: number): number {
    let value = 0;
    for (let index = 0; index < count; index++) {
      const byte = this.bytes[this.start + (this.bit >> 3)]!;
      value = (value << 1) | ((byte >> (7 - (this.bit & 7))) & 1);
      this.bit++;
    }
    return value;
  }
}

// Largest legal big_values: 576 spectral lines in pairs.
const MAX_BIG_VALUES = 288;
// main_data_begin is a 9-bit back-pointer into earlier frames' main data.
const MAX_RESERVOIR_BYTES = 511;

/** Check one audio frame's side information (ISO 11172-3 2.4.1.7) and
 * return how many main-data bytes the frame carries. `reservoir` is the
 * main data available from earlier frames. */
function checkSideInfo(
  bytes: Uint8Array,
  offset: number,
  frame: FrameHeader,
  reservoir: number,
  index: number,
): number {
  const channels = frame.channelMode === "mono" ? 1 : 2;
  const sideStart = offset + 4 + (frame.crc ? 2 : 0);
  const sideBytes = channels === 1 ? 17 : 32;
  const mainBytes = frame.length - (sideStart - offset) - sideBytes;
  const fail = (what: string) =>
    new Mp3InspectionError(
      `Audio frame ${index} has invalid side information (${what}); re-encode the file`,
    );
  if (mainBytes < 0) throw fail("frame too short");
  const bits = new BitReader(bytes, sideStart);
  const mainDataBegin = bits.read(9);
  if (mainDataBegin > Math.min(reservoir, MAX_RESERVOIR_BYTES))
    throw fail("main_data_begin points before the stream");
  bits.read(channels === 1 ? 5 : 3); // private bits
  bits.read(4 * channels); // scfsi
  let totalBits = 0;
  for (let granule = 0; granule < 2; granule++) {
    for (let channel = 0; channel < channels; channel++) {
      totalBits += bits.read(12); // part2_3_length
      if (bits.read(9) > MAX_BIG_VALUES) throw fail("big_values");
      bits.read(8 + 4); // global_gain, scalefac_compress
      if (bits.read(1)) {
        // Window switching: block type 0 is reserved here.
        if (bits.read(2) === 0) throw fail("block_type");
        bits.read(1 + 2 * 5 + 3 * 3);
      } else {
        bits.read(3 * 5 + 4 + 3);
      }
      bits.read(3); // preflag, scalefac_scale, count1table_select
    }
  }
  if (totalBits > 8 * (mainDataBegin + mainBytes))
    throw fail("more coded bits than the frame and reservoir hold");
  return mainBytes;
}

// The Xing/Info tag follows the side information: 32 bytes for MPEG-1
// stereo, 17 for mono, after the 4-byte header.
function infoFrame(
  bytes: Uint8Array,
  frameStart: number,
  frame: FrameHeader,
): Mp3Inspection["infoFrame"] {
  const start = frameStart + 4 + (frame.channelMode === "mono" ? 17 : 32);
  if (start + 8 > frameStart + frame.length) return null;
  const tag = ascii(bytes, start, 4);
  if (tag !== "Xing" && tag !== "Info") return null;
  const flags = readUint32(bytes, start + 4);
  let cursor = start + 8;
  let frames: number | undefined;
  if (flags & 0x1) {
    frames = readUint32(bytes, cursor);
    cursor += 4;
  }
  if (flags & 0x2) cursor += 4;
  if (flags & 0x4) cursor += 100;
  if (flags & 0x8) cursor += 4;
  const end = frameStart + frame.length;
  const encoder =
    cursor + 9 <= end
      ? ascii(bytes, cursor, 9)
          .replaceAll(/[^\x20-\x7e]/g, "")
          .trimEnd()
      : undefined;
  return { tag, ...(frames === undefined ? {} : { frames }), encoder };
}

/** Parse every frame; throws Mp3InspectionError naming the first defect. */
export function inspectMp3(bytes: Uint8Array): Mp3Inspection {
  if (bytes.length === 0) throw new Mp3InspectionError("The file is empty");
  if (ascii(bytes, 0, 3) === "ID3")
    throw new Mp3InspectionError(
      "The file starts with an ID3 tag; export without tags",
    );
  const first = header(bytes, 0);
  if (!first)
    throw new Mp3InspectionError(
      "The file does not start with an MPEG-1 Layer III frame",
    );
  // An encoder's Xing/Info frame may use its own bitrate; the audio frames
  // after it set the configuration every later frame must repeat.
  const info = infoFrame(bytes, 0, first);
  let offset = info ? first.length : 0;
  const audio = header(bytes, offset);
  if (!audio) throw new Mp3InspectionError("The file has no audio frames");
  if (info && audio.sampleRate !== first.sampleRate)
    throw new Mp3InspectionError(
      "The Xing header and the audio use different sample rates",
    );
  let audioFrames = 0;
  let reservoir = 0;
  while (offset < bytes.length) {
    const frame = header(bytes, offset);
    if (!frame) {
      const trailing = ascii(bytes, offset, 8);
      throw new Mp3InspectionError(
        trailing.startsWith("TAG") ||
          trailing.startsWith("APETAGEX") ||
          trailing.startsWith("LYRICS")
          ? "The file ends with a metadata tag; export without tags"
          : `Unexpected data at byte ${offset}; the file must be MP3 frames only`,
      );
    }
    if (
      frame.bitrateKbps !== audio.bitrateKbps ||
      frame.sampleRate !== audio.sampleRate ||
      frame.channelMode !== audio.channelMode
    )
      throw new Mp3InspectionError(
        `Audio frame ${audioFrames} changes bitrate, sample rate or channel mode; use constant bitrate`,
      );
    if (offset + frame.length > bytes.length)
      throw new Mp3InspectionError("The last frame is truncated");
    reservoir += checkSideInfo(bytes, offset, frame, reservoir, audioFrames);
    offset += frame.length;
    audioFrames++;
  }
  if (info?.frames !== undefined && info.frames !== audioFrames)
    throw new Mp3InspectionError(
      `The Xing header counts ${info.frames} frames but the file has ${audioFrames}`,
    );
  return {
    sampleRate: audio.sampleRate,
    bitrateKbps: audio.bitrateKbps,
    channels: audio.channelMode === "mono" ? 1 : 2,
    channelMode: audio.channelMode,
    audioFrames,
    durationSecs: (audioFrames * SAMPLES_PER_FRAME) / audio.sampleRate,
    infoFrame: info,
  };
}
