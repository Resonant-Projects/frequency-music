import { Effect } from "effect";
import { attempt } from "../effects";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// A stuck encoder is killed outright rather than left to hold the job lease.
const EXEC_TIMEOUT = {
  timeout: 10 * 60 * 1000,
  killSignal: "SIGKILL",
} as const;

export type ExecOptions = { signal?: AbortSignal };

function execute(
  executable: string,
  args: string[],
  options: ExecOptions,
  maxBuffer?: number,
) {
  return attempt((signal) =>
    execFileAsync(executable, args, {
      ...EXEC_TIMEOUT,
      ...(maxBuffer === undefined ? {} : { maxBuffer }),
      signal: options.signal
        ? AbortSignal.any([signal, options.signal])
        : signal,
    }),
  );
}

export function runFfmpeg(
  args: string[],
  options: ExecOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  return Effect.runPromise(
    execute(
      "ffmpeg",
      ["-hide_banner", "-nostdin", "-y", ...args],
      options,
      64 * 1024 * 1024,
    ).pipe(
      Effect.mapError((error) => {
        const err = error as NodeJS.ErrnoException & { stderr?: string };
        if (err.code === "ENOENT") return new Error("ffmpeg not found on PATH");
        return new Error(
          `ffmpeg failed: ${(err.stderr ?? err.message).split("\n").slice(-20).join("\n")}`,
        );
      }),
    ),
  );
}

export function runFfprobe(
  args: string[],
  options: ExecOptions = {},
): Promise<string> {
  return Effect.runPromise(
    execute("ffprobe", ["-v", "error", ...args], options).pipe(
      Effect.map(({ stdout }) => stdout),
      Effect.mapError((error) => {
        const err = error as NodeJS.ErrnoException;
        return err.code === "ENOENT"
          ? new Error("ffprobe not found on PATH")
          : error;
      }),
    ),
  );
}
