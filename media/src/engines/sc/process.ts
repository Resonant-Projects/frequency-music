import { spawn } from "node:child_process";

export type Command = {
  executable: string;
  args: string[];
  cwd: string;
  signal: AbortSignal;
  timeoutMs: number;
};
export type RunCommand = (
  command: Command,
) => Promise<{ stdout: string; stderr: string }>;

/** Wait for close after killing, so cleanup cannot race a still-writing child.
 * No shell, inherited stdin, or unbounded process output. */
export const runCommand: RunCommand = async (command) => {
  command.signal.throwIfAborted();
  return await new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH,
        HOME: command.cwd,
        TMPDIR: command.cwd,
        QT_QPA_PLATFORM: "offscreen",
      },
    });
    let stdout = "";
    let stderr = "";
    let failure: Error | undefined;
    const stop = (error: Error) => {
      failure ??= error;
      child.kill("SIGKILL");
    };
    const abort = () => stop(new Error("Renderer aborted"));
    command.signal.addEventListener("abort", abort, { once: true });
    if (command.signal.aborted) abort();
    const timer = setTimeout(
      () => stop(new Error("Renderer process deadline exceeded")),
      command.timeoutMs,
    );
    for (const [stream, name] of [
      [child.stdout, "stdout"],
      [child.stderr, "stderr"],
    ] as const) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk: string) => {
        if (stdout.length + stderr.length + chunk.length > 1024 * 1024) {
          stop(new Error("Renderer process output limit exceeded"));
          return;
        }
        if (name === "stdout") stdout += chunk;
        else stderr += chunk;
      });
    }
    child.on("error", (error) => {
      failure ??= error;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      command.signal.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (code !== 0)
        reject(
          new Error(
            `${command.executable} exited ${code}: ${stderr.split("\n").slice(-20).join("\n")}`,
          ),
        );
      else resolve({ stdout, stderr });
    });
  });
};
