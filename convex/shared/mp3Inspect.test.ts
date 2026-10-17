import { describe, expect, test } from "vite-plus/test";
import { mp3Fixture } from "../../harness/fixtures/mp3";
import { inspectMp3, Mp3InspectionError } from "./mp3Inspect";

const encode = (text: string) => new TextEncoder().encode(text);

describe("inspectMp3", () => {
  test("reads a constant-bitrate file with an Info frame", () => {
    const result = inspectMp3(mp3Fixture({ frames: 1251 }));
    expect(result).toEqual({
      sampleRate: 48000,
      bitrateKbps: 256,
      channels: 2,
      channelMode: "jointStereo",
      audioFrames: 1251,
      durationSecs: 30.024,
      infoFrame: { tag: "Info", frames: 1251, encoder: "Lavf lame" },
    });
  });

  test("reads a file without an Info frame, and mono", () => {
    expect(inspectMp3(mp3Fixture({ frames: 10, info: null })).infoFrame).toBe(
      null,
    );
    const mono = inspectMp3(mp3Fixture({ frames: 10, mode: "mono" }));
    expect(mono.channels).toBe(1);
    expect(mono.infoFrame?.tag).toBe("Info");
  });

  test.each([
    ["an ID3v2 prefix", { prefix: encode("ID3\u0004\0\0\0\0\0\0") }, /ID3/],
    [
      "an ID3v1 suffix",
      { suffix: encode(`TAG${"x".repeat(125)}`) },
      /metadata tag/,
    ],
    ["an APE suffix", { suffix: encode("APETAGEX0000") }, /metadata tag/],
    ["junk after the frames", { suffix: encode("junk") }, /Unexpected data/],
    [
      "a truncated last frame",
      { suffix: mp3Fixture({ frames: 1, info: null }).subarray(0, 100) },
      /truncated/,
    ],
    [
      "a lying Xing count",
      { info: { encoder: "Lavf lame", frames: 9 } },
      /counts 9 frames/,
    ],
  ])("refuses %s", (_name, options, message) => {
    expect(() => inspectMp3(mp3Fixture({ frames: 10, ...options }))).toThrow(
      message,
    );
  });

  test("refuses variable bitrate and non-MP3 data", () => {
    const vbr = new Uint8Array([
      ...mp3Fixture({ frames: 3, info: null }),
      ...mp3Fixture({ frames: 3, info: null, bitrateKbps: 320 }),
    ]);
    expect(() => inspectMp3(vbr)).toThrow(/constant bitrate/);
    expect(() => inspectMp3(encode("RIFF....WAVEfmt "))).toThrow(
      Mp3InspectionError,
    );
    expect(() => inspectMp3(new Uint8Array())).toThrow(/empty/);
    expect(() => inspectMp3(mp3Fixture({ frames: 0 }))).toThrow(
      /no audio frames/,
    );
  });

  // Side information starts after the 4-byte header of the first audio frame,
  // which follows the 768-byte Info frame in these fixtures.
  function corruptSideInfo(bitOffset: number, count: number, value: number) {
    const bytes = mp3Fixture({ frames: 10 });
    const start = (768 + 4) * 8 + bitOffset;
    for (let index = 0; index < count; index++) {
      const bit = start + index;
      const mask = 0x80 >> (bit & 7);
      if ((value >> (count - 1 - index)) & 1) bytes[bit >> 3]! |= mask;
      else bytes[bit >> 3]! &= ~mask;
    }
    return bytes;
  }

  test("refuses frames whose side information cannot decode", () => {
    // main_data_begin is bits 0-8; the first frame has no reservoir.
    expect(() => inspectMp3(corruptSideInfo(0, 9, 100))).toThrow(
      /main_data_begin/,
    );
    // Granule 0, channel 0: part2_3_length at bit 20, big_values at bit 32.
    expect(() => inspectMp3(corruptSideInfo(32, 9, 289))).toThrow(/big_values/);
    expect(() => inspectMp3(corruptSideInfo(32, 9, 288))).not.toThrow();
    // window_switching_flag at bit 53, then block_type 0 is reserved.
    expect(() => inspectMp3(corruptSideInfo(53, 3, 0b100))).toThrow(
      /block_type/,
    );
    // Two granules of 4095 bits each exceed the 732 main-data bytes.
    const bytes = corruptSideInfo(20, 12, 4095);
    const second = (768 + 4) * 8 + 20 + 59;
    for (let bit = second; bit < second + 12; bit++)
      bytes[bit >> 3]! |= 0x80 >> (bit & 7);
    expect(() => inspectMp3(bytes)).toThrow(/more coded bits/);
  });
});
