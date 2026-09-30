import { runFfmpeg, runFfprobe } from "./ffmpeg";

// LAME's CBR presets scale the input before encoding (presets.c,
// abr_switch_map "scale" column): 0.95 up to 160 kbps, 0.97 at 192, 0.98 at
// 224, none from 256 (a tone measured -0.446, -0.446, -0.265 and 0 dB at 128,
// 160, 192 and 256 kbps). At 128 kbps every delivery decoded 0.45 LU under
// its master, most of the ±0.5 LU tolerance. The encode undoes it so a
// delivery plays at its master's loudness; the loudness test pins this.
const LAME_PRESET_SCALE: readonly [maxKbps: number, scale: number][] = [
  [160, 0.95],
  [192, 0.97],
  [224, 0.98],
];

function lameScaleCompensationDb(bitrateKbps: number): number {
  const scale =
    LAME_PRESET_SCALE.find(([maxKbps]) => bitrateKbps <= maxKbps)?.[1] ?? 1;
  return -20 * Math.log10(scale);
}

export async function encodeMp3(
  input: string,
  output: string,
  options: { bitrateKbps: number; channels: 1 | 2; title?: string },
  signal?: AbortSignal,
): Promise<void> {
  // -map_metadata -1 strips every input tag and -fflags +bitexact stops the
  // muxer from writing its own encoder tag; blind deliveries must carry none.
  await runFfmpeg(
    [
      "-i",
      input,
      "-map_metadata",
      "-1",
      "-fflags",
      "+bitexact",
      "-af",
      `volume=${lameScaleCompensationDb(options.bitrateKbps).toFixed(4)}dB`,
      "-ar",
      "48000",
      "-ac",
      String(options.channels),
      "-c:a",
      "libmp3lame",
      "-b:a",
      `${options.bitrateKbps}k`,
      "-id3v2_version",
      "0",
      "-write_xing",
      "1",
      output,
    ],
    { signal },
  );
}

// 24-bit is the wave 0 default (the probe's master). Wave 1 masters are
// 16-bit: Cloudflare caps one request body at 100 MB, and a 14-minute mono
// master is ~121 MB at 24-bit against ~81 MB at 16-bit.
export async function encodeWav(
  input: string,
  output: string,
  options: { channels: 1 | 2; bitDepth?: 16 | 24 },
  signal?: AbortSignal,
): Promise<void> {
  await runFfmpeg(
    [
      "-i",
      input,
      "-map_metadata",
      "-1",
      "-fflags",
      "+bitexact",
      "-ar",
      "48000",
      "-ac",
      String(options.channels),
      "-c:a",
      options.bitDepth === 16 ? "pcm_s16le" : "pcm_s24le",
      output,
    ],
    { signal },
  );
}

export async function probeStreams(
  path: string,
  signal?: AbortSignal,
): Promise<{
  codec: string;
  channels: number;
  sampleRate: number;
  tags: Record<string, string>;
}> {
  const text = await runFfprobe(
    [
      "-show_entries",
      "stream=codec_name,channels,sample_rate:format_tags",
      "-of",
      "json",
      path,
    ],
    { signal },
  );
  const parsed = JSON.parse(text) as {
    streams: { codec_name: string; channels: number; sample_rate: string }[];
    format?: { tags?: Record<string, string> };
  };
  const stream = parsed.streams[0];
  if (!stream) throw new Error("no audio stream");
  return {
    codec: stream.codec_name,
    channels: stream.channels,
    sampleRate: Number(stream.sample_rate),
    tags: parsed.format?.tags ?? {},
  };
}
