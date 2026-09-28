import { runFfmpeg, runFfprobe } from "./ffmpeg";

export async function encodeMp3(
  input: string,
  output: string,
  options: { bitrateKbps: number; channels: 1 | 2; title?: string },
): Promise<void> {
  // -map_metadata -1 strips every input tag and -fflags +bitexact stops the
  // muxer from writing its own encoder tag; blind deliveries must carry none.
  await runFfmpeg([
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
    "libmp3lame",
    "-b:a",
    `${options.bitrateKbps}k`,
    "-id3v2_version",
    "0",
    "-write_xing",
    "1",
    output,
  ]);
}

export async function encodeWav(
  input: string,
  output: string,
  channels: 1 | 2,
): Promise<void> {
  await runFfmpeg([
    "-i",
    input,
    "-map_metadata",
    "-1",
    "-fflags",
    "+bitexact",
    "-ar",
    "48000",
    "-ac",
    String(channels),
    "-c:a",
    "pcm_s24le",
    output,
  ]);
}

export async function probeStreams(path: string): Promise<{
  codec: string;
  channels: number;
  sampleRate: number;
  tags: Record<string, string>;
}> {
  const text = await runFfprobe([
    "-show_entries",
    "stream=codec_name,channels,sample_rate:format_tags",
    "-of",
    "json",
    path,
  ]);
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
