import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  truncate,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { renderLocal } from "../src/engines/sc";
import {
  buildScores,
  scString,
  MAX_LITMUS_FUNDAMENTAL_HZ,
  MAX_CONCURRENT_VOICES,
} from "../src/engines/sc/score";
import {
  runCommand,
  type Command,
  type RunCommand,
} from "../src/engines/sc/process";
const plan = {
  version: 1,
  engine: "sc-litmus",
  tuning: { kind: "edo", divisions: 19 },
  referenceHz: 432,
  normalize: false,
  tempoBpm: 120,
  durationSecs: 2,
  seed: [
    { degree: 1, octave: 0, startBeat: 0, beats: 3, velocity: 127 },
    { degree: 2, octave: 0, startBeat: 1, beats: 1, velocity: 64 },
  ],
};
const densePlan = {
  ...plan,
  referenceHz: 440,
  durationSecs: 0.5,
  seed: Array.from({ length: 512 }, () => ({
    degree: 0,
    octave: 0,
    startBeat: 0,
    beats: 0.125,
    velocity: 127,
  })),
};
function astatsSummary(peak: number | string, nanCount = "0", infCount = "0") {
  return ["Channel: 1", "Channel: 2", "Overall"]
    .map(
      (label) =>
        `${label}\nPeak level dB: ${peak}\nNumber of NaNs: ${nanCount}\nNumber of Infs: ${infCount}`,
    )
    .join("\n");
}
const roots: string[] = [];
async function root() {
  const path = await mkdtemp(join(tmpdir(), "renderer-test-"));
  roots.push(path);
  return path;
}
afterEach(async () => {
  for (const path of roots.splice(0))
    await rm(path, { recursive: true, force: true });
});
function fakeRuntime(
  calls: Command[],
  badCodec = false,
  peak = -3,
  duration = 2,
): RunCommand {
  return async (command) => {
    calls.push(command);
    const { executable, args } = command;
    if (executable === "sclang") {
      expect(await readFile(args[1]!, "utf8")).toContain("~litmus.asBytes");
      await writeFile(
        args[1]!.replace("score.scd", "score.osc"),
        "osc fixture",
      );
    } else if (executable === "scsynth")
      await writeFile(args[3]!, "audio fixture");
    else if (executable === "ffprobe") {
      const file = basename(args.at(-1)!);
      return {
        stdout: JSON.stringify({
          streams: [
            {
              codec_name: badCodec
                ? "pcm_s16le"
                : file.endsWith("mp3")
                  ? "mp3"
                  : file.includes("master")
                    ? "pcm_s24le"
                    : "pcm_f32le",
              channels: 2,
              sample_rate: "48000",
            },
          ],
          format: {
            duration: String(duration + (file.includes("raw") ? 0.01 : 0)),
          },
        }),
        stderr: "",
      };
    } else if (args.at(-1) !== "-")
      await writeFile(args.at(-1)!, "audio fixture");
    return {
      stdout: "",
      stderr: `I: -18 LUFS\nPeak: ${peak} dBFS\n${astatsSummary(peak)}`,
    };
  };
}
describe("SC score", () => {
  it("preserves shared seed, microtonal pitch and max-end loop timing", () => {
    const [a, b] = buildScores({
      ...plan,
      variable: { kind: "referenceHz", variants: [440] },
    });
    expect(a!.member.seed).toBe(b!.member.seed);
    expect(Object.isFrozen(a!.member.seed)).toBe(true);
    expect(a!.notes.map((n) => [n.start, n.end])).toEqual([
      [0, 1.5],
      [0.5, 1],
      [1.5, 2],
    ]);
    expect(a!.notes[0]!.hz).toBeCloseTo(432 * 2 ** (1 / 19), 10);
    expect(a!.notes[1]!.hz).toBeCloseTo(432 * 2 ** (2 / 19), 10);
    expect(b!.notes.map(({ hz: _hz, ...note }) => note)).toEqual(
      a!.notes.map(({ hz: _hz, ...note }) => note),
    );
    expect(buildScores(plan)[0]!.source("synth", "/tmp/score.osc")).toBe(
      buildScores(plan)[0]!.source("synth", "/tmp/score.osc"),
    );
  });
  it("rejects oversize plans and code-shaped input and quotes paths", () => {
    expect(() => buildScores({ ...plan, durationSecs: 91 })).toThrow();
    expect(() =>
      buildScores({
        ...plan,
        durationSecs: 90,
        tempoBpm: 400,
        seed: [{ ...plan.seed[0], beats: 1 / 64 }],
      }),
    ).toThrow(/8192/);
    expect(() =>
      buildScores({ ...plan, referenceHz: '440); "pwn".unixCmd;' }),
    ).toThrow();
    expect(scString('a"b')).toBe('"a\\"b"');
    expect(() => scString("a\nb")).toThrow();
  });
  it("rejects aliasing fundamentals in baseline and variants without dropping partials", () => {
    const seed = [
      { degree: 0, octave: 4, startBeat: 0, beats: 1, velocity: 127 },
    ];
    expect(() => buildScores({ ...plan, referenceHz: 440, seed })).toThrow(
      /four-partial limit/,
    );
    // Exactly 6 kHz would put the fourth partial at Nyquist.
    expect(() =>
      buildScores({
        ...plan,
        referenceHz: 1500,
        seed: [{ ...seed[0], octave: 2 }],
      }),
    ).toThrow(/four-partial limit/);
    const admitted = {
      ...plan,
      referenceHz: MAX_LITMUS_FUNDAMENTAL_HZ / 4,
      seed: [{ ...seed[0], octave: 2 }],
    };
    const [score] = buildScores(admitted);
    expect(score!.notes.every((note) => note.hz * 4 < 24000)).toBe(true);
    expect(() =>
      buildScores({
        ...admitted,
        variable: { kind: "referenceHz", variants: [1500] },
      }),
    ).toThrow(/four-partial limit/);
  });
  it("counts overlapping release tails and rejects excessive concurrency", () => {
    const [score] = buildScores(densePlan);
    expect(score!.notes).toHaveLength(4096);
    // Six onsets coexist: the 62.5 ms gate plus 300 ms release lasts 362.5 ms.
    expect(score!.maxConcurrentVoices).toBe(3072);
    expect(score!.maxNodes).toBe(4096);
    expect(score!.maxNodes).toBeGreaterThan(score!.maxConcurrentVoices);
    expect(score!.maxConcurrentVoices).toBeLessThanOrEqual(
      MAX_CONCURRENT_VOICES,
    );
    expect(() =>
      buildScores({
        ...densePlan,
        durationSecs: 0.1,
        tempoBpm: 400,
        seed: Array.from({ length: 1024 }, () => ({
          ...densePlan.seed[0],
          beats: 0.125,
        })),
      }),
    ).toThrow(/concurrent voices including release tails/);
  });
  it("pins the specified synth", async () => {
    const synth = await readFile(
      new URL("../src/engines/sc/litmus.scd", import.meta.url),
      "utf8",
    );
    expect(synth).toContain("[1, 2, 3, 4]");
    expect(synth).toContain("[1, 0.5, 0.25, 0.125]");
    expect(synth).toContain("Env.asr(0.02, 1, 0.3");
  });
});
describe("mocked rendering", () => {
  it.each([false, true])(
    "writes private stereo artifacts, normalize=%s",
    async (normalize) => {
      const calls: Command[] = [];
      const result = await renderLocal(
        { ...plan, normalize },
        { tempRoot: await root(), run: fakeRuntime(calls) },
      );
      expect((await stat(result.directory)).mode & 0o777).toBe(0o700);
      expect((await stat(result.artifacts[0]!.master)).mode & 0o777).toBe(
        0o600,
      );
      expect(calls.some((c) => c.args.includes("pcm_s24le"))).toBe(true);
      expect(calls.some((c) => c.args.includes("256k"))).toBe(true);
      expect(calls.every((c) => c.timeoutMs === 60_000)).toBe(true);
      expect(
        calls.filter((c) => c.args.includes("ebur128=peak=true")),
      ).toHaveLength(normalize ? 3 : 0);
      expect(
        calls.filter((c) => c.args.includes("astats=metadata=0:reset=0")),
      ).toHaveLength(1);
      if (!normalize)
        expect(calls.find((c) => c.args.includes("pcm_s24le"))!.args).toContain(
          "volume=0dB",
        );
      await result.dispose();
      await expect(stat(result.directory)).rejects.toThrow();
    },
  );
  it.each(["process", "format", "missing", "size", "abort", "loudness"])(
    "cleans after %s failure",
    async (failure) => {
      const tempRoot = await root();
      const controller = new AbortController();
      const fake = fakeRuntime(
        [],
        failure === "format",
        failure === "loudness" ? 0 : -3,
      );
      const run: RunCommand = async (command) => {
        if (failure === "process") throw new Error("sclang failed");
        if (failure === "abort") controller.abort();
        if (failure === "missing") return { stdout: "", stderr: "" };
        const result = await fake(command);
        if (failure === "size" && command.executable === "scsynth")
          await truncate(command.args[3]!, 95_000_001);
        return result;
      };
      await expect(
        renderLocal(
          { ...plan, normalize: failure === "loudness" },
          { tempRoot, run, signal: controller.signal },
        ),
      ).rejects.toThrow();
      expect(await readdir(tempRoot)).toEqual([]);
    },
  );
  it("configures enough SC nodes for the dense valid fixture", async () => {
    const calls: Command[] = [];
    const result = await renderLocal(densePlan, {
      tempRoot: await root(),
      run: fakeRuntime(calls, false, -3, 0.5),
    });
    const args = calls.find((c) => c.executable === "scsynth")!.args;
    expect(args[args.indexOf("-n") + 1]).toBe("4096");
    expect(args[args.indexOf("-z") + 1]).toBe("64");
    await result.dispose();
  });
  it.each(["stdout", "stderr"] as const)(
    "rejects zero-exit SC failures on %s and cleans files",
    async (channel) => {
      const tempRoot = await root();
      const calls: Command[] = [];
      const fake = fakeRuntime(calls);
      await expect(
        renderLocal(plan, {
          tempRoot,
          run: async (command) => {
            const result = await fake(command);
            if (command.executable === "scsynth")
              result[channel] = "FAILURE IN SERVER /s_new too many nodes";
            return result;
          },
        }),
      ).rejects.toThrow(/synthesis diagnostic/);
      expect(calls.some((c) => c.executable === "ffprobe")).toBe(false);
      expect(await readdir(tempRoot)).toEqual([]);
    },
  );
  it.each([20 * Math.log10(1.191), 0, 0.000001])(
    "rejects unnormalized float peak %s before fixed-point conversion",
    async (peak) => {
      const tempRoot = await root();
      const calls: Command[] = [];
      const chord = {
        ...plan,
        referenceHz: 440,
        seed: Array.from({ length: 16 }, () => ({
          degree: 0,
          octave: 0,
          startBeat: 0,
          beats: 4,
          velocity: 127,
        })),
      };
      await expect(
        renderLocal(chord, { tempRoot, run: fakeRuntime(calls, false, peak) }),
      ).rejects.toThrow(/cannot fit 24-bit PCM without clipping/);
      expect(calls.some((c) => c.args.includes("pcm_s24le"))).toBe(false);
      expect(calls.some((c) => c.args.includes("libmp3lame"))).toBe(false);
      expect(await readdir(tempRoot)).toEqual([]);
    },
  );
  it.each(["", astatsSummary("NaN"), astatsSummary("inf")])(
    "fails closed on invalid float peak measurements: %s",
    async (stderr) => {
      const tempRoot = await root();
      const fake = fakeRuntime([]);
      await expect(
        renderLocal(plan, {
          tempRoot,
          run: async (command) =>
            command.args.includes("astats=metadata=0:reset=0")
              ? { stdout: "", stderr }
              : fake(command),
        }),
      ).rejects.toThrow(/float peak measurement/);
      expect(await readdir(tempRoot)).toEqual([]);
    },
  );
  it.each([
    ["mixed NaN", astatsSummary(-6.0206, "1")],
    ["mixed Inf", astatsSummary(-6.0206, "0", "1")],
    ["missing count", astatsSummary(-6.0206).replace("Number of NaNs: 0", "")],
    ["malformed count", astatsSummary(-6.0206, "NaN")],
    ["negative count", astatsSummary(-6.0206, "-1")],
    [
      "fractional overall count",
      astatsSummary(-6.0206).replace(
        "Overall\nPeak level dB: -6.0206\nNumber of NaNs: 0",
        "Overall\nPeak level dB: -6.0206\nNumber of NaNs: 0.5",
      ),
    ],
    [
      "duplicate count",
      astatsSummary(-6.0206).replace(
        "Number of Infs: 0",
        "Number of Infs: 0\nNumber of Infs: 0",
      ),
    ],
  ])("rejects untrustworthy sample counts: %s", async (_label, stderr) => {
    const tempRoot = await root();
    const calls: Command[] = [];
    const fake = fakeRuntime(calls);
    await expect(
      renderLocal(plan, {
        tempRoot,
        run: async (command) => {
          const result = await fake(command);
          return command.args.includes("astats=metadata=0:reset=0")
            ? { ...result, stderr }
            : result;
        },
      }),
    ).rejects.toThrow(/Invalid renderer float/);
    expect(calls.some((command) => command.args.includes("pcm_s24le"))).toBe(
      false,
    );
    expect(await readdir(tempRoot)).toEqual([]);
  });
  it("rejects invalid input and pre-abort without files", async () => {
    const tempRoot = await root();
    await expect(renderLocal({}, { tempRoot })).rejects.toThrow();
    await expect(
      renderLocal(plan, { tempRoot, signal: AbortSignal.abort() }),
    ).rejects.toThrow();
    expect(await readdir(tempRoot)).toEqual([]);
  });
});
describe("actual subprocess control without SC", () => {
  it.each(["deadline", "abort", "output", "missing"])(
    "bounds %s",
    async (kind) => {
      const cwd = await root();
      await expect(
        runCommand({
          executable:
            kind === "missing" ? join(cwd, "missing") : process.execPath,
          args: [
            "-e",
            kind === "output"
              ? "process.stdout.write('x'.repeat(2 * 1024 * 1024))"
              : "setInterval(() => {}, 1000)",
          ],
          cwd,
          signal:
            kind === "abort"
              ? AbortSignal.timeout(30)
              : new AbortController().signal,
          timeoutMs: kind === "deadline" ? 30 : 1000,
        }),
      ).rejects.toThrow(
        kind === "missing"
          ? /ENOENT/
          : kind === "abort"
            ? /aborted/
            : kind === "output"
              ? /output limit/
              : /deadline/,
      );
    },
  );
});

// Only SC is mocked here. The WAV samples and all ffmpeg/ffprobe work are real.
const hasAudioTools = ["ffmpeg", "ffprobe"].every(
  (executable) =>
    spawnSync(executable, ["-version"], { timeout: 5000, stdio: "ignore" })
      .status === 0,
);
function floatWav(sample: number, exceptionalSample?: number) {
  const frames = Math.round(2.01 * 48000);
  const dataBytes = frames * 2 * 4;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(3, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(48000, 24);
  wav.writeUInt32LE(48000 * 8, 28);
  wav.writeUInt16LE(8, 32);
  wav.writeUInt16LE(32, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataBytes, 40);
  for (let offset = 44; offset < wav.length; offset += 4)
    wav.writeFloatLE(sample, offset);
  if (exceptionalSample !== undefined)
    wav.writeFloatLE(exceptionalSample, 44 + 24000 * 8);
  return wav;
}
describe.skipIf(!hasAudioTools)(
  "real ffmpeg float sample validation with mocked SC",
  () => {
    it.each([NaN, Infinity, -Infinity])(
      "rejects mixed finite samples and %s before conversion",
      async (exceptionalSample) => {
        const tempRoot = await root();
        const calls: Command[] = [];
        let measured = "";
        await expect(
          renderLocal(plan, {
            tempRoot,
            run: async (command) => {
              calls.push(command);
              if (command.executable === "sclang") {
                await writeFile(
                  command.args[1]!.replace("score.scd", "score.osc"),
                  "mock score",
                );
                return { stdout: "", stderr: "" };
              }
              if (command.executable === "scsynth") {
                await writeFile(
                  command.args[3]!,
                  floatWav(0.5, exceptionalSample),
                );
                return { stdout: "", stderr: "" };
              }
              const result = await runCommand(command);
              if (command.args.includes("astats=metadata=0:reset=0"))
                measured = result.stderr;
              return result;
            },
          }),
        ).rejects.toThrow(/NaN\/Inf counts/);
        expect(measured).toMatch(
          Number.isNaN(exceptionalSample)
            ? /Number of NaNs: 1/
            : /Number of Infs: 1/,
        );
        if (Number.isNaN(exceptionalSample))
          expect(measured).toMatch(/Peak level dB: -6\.020600/);
        expect(
          calls.some((command) => command.args.includes("pcm_s24le")),
        ).toBe(false);
        expect(await readdir(tempRoot)).toEqual([]);
      },
    );
    it("accepts genuine silence with -inf peak and explicit zero counts", async () => {
      const result = await renderLocal(plan, {
        tempRoot: await root(),
        run: async (command) => {
          if (command.executable === "sclang") {
            await writeFile(
              command.args[1]!.replace("score.scd", "score.osc"),
              "mock score",
            );
            return { stdout: "", stderr: "" };
          }
          if (command.executable === "scsynth") {
            await writeFile(command.args[3]!, floatWav(0));
            return { stdout: "", stderr: "" };
          }
          return runCommand(command);
        },
      });
      expect((await stat(result.artifacts[0]!.master)).size).toBeGreaterThan(
        44,
      );
      await result.dispose();
    });
  },
);
