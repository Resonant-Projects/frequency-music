import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  buildScores,
  SCORE_LEAD_SECS,
  SC_BLOCK_SIZE,
  SC_REAL_TIME_MEMORY_KB,
} from "./score";
import { runCommand, type RunCommand } from "./process";

const MAX_BYTES = 95_000_000;
const SAMPLE_RATE = 48000;

/** Offline only. Files are private working artifacts, with no evidence gate
 * status or upload capability. Caller must dispose the successful result. */
export async function renderLocal(
  input: unknown,
  options: {
    signal?: AbortSignal;
    tempRoot?: string;
    run?: RunCommand;
  } = {},
) {
  const scores = buildScores(input);
  options.signal?.throwIfAborted();
  const deadline = AbortSignal.timeout(5 * 60_000);
  const signal = options.signal
    ? AbortSignal.any([deadline, options.signal])
    : deadline;
  const directory = await mkdtemp(
    join(resolve(options.tempRoot ?? tmpdir()), "frequency-sc-"),
  );
  const dispose = () => rm(directory, { recursive: true, force: true });
  const run = options.run ?? runCommand;
  const command = async (executable: string, args: string[]) => {
    signal.throwIfAborted();
    const result = await run({
      executable,
      args,
      cwd: directory,
      signal,
      timeoutMs: 60_000,
    });
    signal.throwIfAborted();
    if (executable === "scsynth" || executable === "sclang") {
      const diagnostic = `${result.stdout}\n${result.stderr}`
        .split("\n")
        .find((line) =>
          /\bFAILURE IN SERVER\b|\bFAIL(?:ED|URE)?\s*(?:IN|:|\/)|\bERROR\b|\bexception\b|too many (?:nodes|synths)|node (?:allocation|not found)|alloc(?:ation)? failed|out of (?:real time |realtime )?memory/i.test(
            line,
          ),
        );
      if (diagnostic)
        throw new Error(`${executable} synthesis diagnostic: ${diagnostic}`);
    }
    return result;
  };
  const ffmpeg = (args: string[]) =>
    command("ffmpeg", ["-hide_banner", "-nostdin", "-y", ...args]);
  const checkFile = async (path: string) => {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_BYTES)
      throw new Error("Invalid renderer output file or 95 MB cap exceeded");
    await chmod(path, 0o600);
  };
  const validateAudio = async (
    path: string,
    duration: number,
    codec: string,
  ) => {
    await checkFile(path);
    const { stdout } = await command("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      path,
    ]);
    const probe = JSON.parse(stdout);
    const stream = probe.streams?.[0];
    const actual = Number(probe.format?.duration);
    if (
      probe.streams?.length !== 1 ||
      stream?.codec_name !== codec ||
      stream?.channels !== 2 ||
      Number(stream?.sample_rate) !== SAMPLE_RATE ||
      !Number.isFinite(actual) ||
      Math.abs(actual - duration) > 0.1
    )
      throw new Error("Invalid renderer audio format or duration");
    // Decode the whole file, rejecting corrupt frames, not just a valid header.
    await ffmpeg(["-v", "error", "-xerror", "-i", path, "-f", "null", "-"]);
  };
  // astats reports sample peaks with more precision than ebur128's rounded
  // true-peak summary. Run on float before any fixed-point conversion.
  const measureFloatPeak = async (path: string) => {
    const { stderr } = await ffmpeg([
      "-i",
      path,
      "-af",
      "astats=metadata=0:reset=0",
      "-f",
      "null",
      "-",
    ]);
    // Require both channel summaries and the overall summary. A finite peak
    // does not imply finite samples: astats can ignore a NaN when finding it.
    const summaries = new Map<string, Map<string, string>>();
    let summary: Map<string, string> | undefined;
    for (const rawLine of stderr.split("\n")) {
      const line = rawLine.replace(/^\[Parsed_astats_[^\]]+\]\s*/, "").trim();
      if (/^(?:Channel:|Overall)/.test(line)) {
        if (
          !["Channel: 1", "Channel: 2", "Overall"].includes(line) ||
          summaries.has(line)
        )
          throw new Error("Invalid renderer float peak measurement summaries");
        summary = new Map();
        summaries.set(line, summary);
      }
      const field =
        /^(Peak level dB|Number of NaNs|Number of Infs):\s*(.*)$/.exec(line);
      if (field) {
        if (!summary || summary.has(field[1]!))
          throw new Error("Invalid renderer float peak measurement fields");
        summary.set(field[1]!, field[2]!);
      }
    }
    if (summaries.size !== 3)
      throw new Error("Invalid renderer float peak measurement summaries");
    const peaks = [];
    for (const fields of summaries.values()) {
      // Accept only an explicit zero count. Missing, malformed, nonfinite,
      // negative, or nonzero counts all fail before PCM conversion.
      for (const name of ["Number of NaNs", "Number of Infs"]) {
        if (!/^0(?:\.0+)?$/.test(fields.get(name) ?? ""))
          throw new Error(
            "Invalid renderer float samples: NaN/Inf counts must be present and zero",
          );
      }
      const text = fields.get("Peak level dB") ?? "";
      const peak = text.toLowerCase() === "-inf" ? -Infinity : Number(text);
      if (
        !/^-?(?:\d+(?:\.\d+)?|inf)$/i.test(text) ||
        Number.isNaN(peak) ||
        peak === Infinity
      )
        throw new Error("Invalid renderer float peak measurement");
      peaks.push(peak);
    }
    return Math.max(...peaks);
  };
  const measure = async (path: string) => {
    const { stderr } = await ffmpeg([
      "-i",
      path,
      "-af",
      "ebur128=peak=true",
      "-f",
      "null",
      "-",
    ]);
    const lufs = Number(
      [...stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)?.[1],
    );
    const peak = Number(
      [...stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)?.[1],
    );
    if (!Number.isFinite(lufs) || !Number.isFinite(peak))
      throw new Error("Invalid renderer loudness measurement");
    return { lufs, peak };
  };
  try {
    await chmod(directory, 0o700);
    const synth = await readFile(
      new URL("./litmus.scd", import.meta.url),
      "utf8",
    );
    const artifacts = [];
    for (const [index, score] of scores.entries()) {
      const path = (suffix: string) => join(directory, `${index}-${suffix}`);
      const script = path("score.scd");
      const osc = path("score.osc");
      const raw = path("raw.wav");
      const trimmed = path("trimmed.wav");
      const master = path("master.wav");
      const delivery = path("delivery.mp3");
      await writeFile(script, score.source(synth, osc), {
        mode: 0o600,
        flag: "wx",
      });
      await command("sclang", ["-D", script]);
      await checkFile(osc);
      await command("scsynth", [
        "-N",
        osc,
        "_",
        raw,
        "48000",
        "WAV",
        "float",
        "-o",
        "2",
        "-i",
        "0",
        "-D",
        "0",
        "-n",
        String(score.maxNodes),
        "-m",
        String(SC_REAL_TIME_MEMORY_KB),
        "-z",
        String(SC_BLOCK_SIZE),
      ]);
      await validateAudio(
        raw,
        score.member.durationSecs + SCORE_LEAD_SECS,
        "pcm_f32le",
      );
      await ffmpeg([
        "-i",
        raw,
        "-af",
        `atrim=start=${SCORE_LEAD_SECS}:duration=${score.member.durationSecs},asetpts=PTS-STARTPTS`,
        "-ar",
        "48000",
        "-ac",
        "2",
        "-c:a",
        "pcm_f32le",
        trimmed,
      ]);
      await validateAudio(trimmed, score.member.durationSecs, "pcm_f32le");
      const floatPeak = await measureFloatPeak(trimmed);
      // Zero dBFS also fails conservatively: +1 is not representable in s24,
      // and a peak rounded to zero must not be silently clipped.
      if (!score.member.normalize && floatPeak >= 0)
        throw new Error(
          "Unnormalized float audio cannot fit 24-bit PCM without clipping; gain is unchanged",
        );
      let gain = 0;
      if (score.member.normalize) {
        const measurement = await measure(trimmed);
        gain = -18 - measurement.lufs;
        // Fixed timbre must not be changed by a dynamics processor. Fail when
        // linear normalization cannot meet both loudness and true-peak policy.
        if (measurement.peak + gain > -1.1)
          throw new Error("Music cannot meet loudness policy with linear gain");
      }
      await ffmpeg([
        "-i",
        trimmed,
        "-map_metadata",
        "-1",
        "-fflags",
        "+bitexact",
        "-af",
        `volume=${gain}dB`,
        "-ar",
        "48000",
        "-ac",
        "2",
        "-c:a",
        "pcm_s24le",
        master,
      ]);
      await validateAudio(master, score.member.durationSecs, "pcm_s24le");
      // 256 kbps avoids the spoken 128 kbps preset's attenuation compensation.
      await ffmpeg([
        "-i",
        master,
        "-map_metadata",
        "-1",
        "-fflags",
        "+bitexact",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "256k",
        "-id3v2_version",
        "0",
        "-write_xing",
        "1",
        delivery,
      ]);
      await validateAudio(delivery, score.member.durationSecs, "mp3");
      if (score.member.normalize) {
        for (const file of [master, delivery]) {
          const measured = await measure(file);
          if (Math.abs(measured.lufs + 18) > 0.5 || measured.peak > -1)
            throw new Error("Music loudness outside policy");
        }
      }
      artifacts.push({
        master,
        delivery,
        durationSecs: score.member.durationSecs,
      });
    }
    signal.throwIfAborted();
    return { directory, artifacts, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}
