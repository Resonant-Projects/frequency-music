import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runFfmpeg(
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "ffmpeg",
      ["-hide_banner", "-nostdin", "-y", ...args],
      { maxBuffer: 64 * 1024 * 1024 },
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

export async function runFfprobe(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", ...args]);
    return stdout;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") throw new Error("ffprobe not found on PATH");
    throw error;
  }
}
