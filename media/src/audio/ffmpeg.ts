import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// A stuck encoder is killed outright rather than left to hold the job lease.
const EXEC_TIMEOUT = {
  timeout: 10 * 60 * 1000,
  killSignal: "SIGKILL",
} as const;

export type ExecOptions = { signal?: AbortSignal };

export async function runFfmpeg(
  args: string[],
  options: ExecOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "ffmpeg",
      ["-hide_banner", "-nostdin", "-y", ...args],
      { maxBuffer: 64 * 1024 * 1024, ...EXEC_TIMEOUT, signal: options.signal },
    );
    return { stdout, stderr };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stderr?: string };
    if (err.code === "ENOENT") throw new Error("ffmpeg not found on PATH");
    throw new Error(
      `ffmpeg failed: ${(err.stderr ?? err.message).split("\n").slice(-20).join("\n")}`,
    );
  }
}

export async function runFfprobe(
  args: string[],
  options: ExecOptions = {},
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", ...args],
      { ...EXEC_TIMEOUT, signal: options.signal },
    );
    return stdout;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") throw new Error("ffprobe not found on PATH");
    throw error;
  }
}
