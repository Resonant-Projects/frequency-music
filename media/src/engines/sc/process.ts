import { spawn } from "node:child_process";
import { Effect } from "effect";

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

/** The child resource closes before the caller can remove its work directory. */
export const runCommand: RunCommand = (command) =>
  Effect.runPromise(
    Effect.gen(function* () {
      if (command.signal.aborted)
        return yield* Effect.fail(command.signal.reason);
      const resource = yield* Effect.acquireRelease(
        Effect.sync(() => ({
          child: spawn(command.executable, command.args, {
            cwd: command.cwd,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              PATH: process.env.PATH,
              HOME: command.cwd,
              TMPDIR: command.cwd,
              QT_QPA_PLATFORM: process.platform === "darwin" ? "cocoa" : "offscreen",
            },
          }),
          closed: false,
        })),
        (resource) =>
          Effect.promise(async () => {
            if (resource.closed) return;
            await new Promise<void>((resolve) => {
              resource.child.once("close", () => resolve());
              resource.child.kill("SIGKILL");
            });
          }),
      );
      const { child } = resource;
      const monitor = Effect.callback<
        { stdout: string; stderr: string },
        Error
      >((resume) => {
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
        const readers = [child.stdout, child.stderr].map((stream, index) => {
          const read = (chunk: string) => {
            if (stdout.length + stderr.length + chunk.length > 1024 * 1024) {
              stop(new Error("Renderer process output limit exceeded"));
            } else if (index === 0) stdout += chunk;
            else stderr += chunk;
          };
          stream.setEncoding("utf8");
          stream.on("data", read);
          return () => stream.off("data", read);
        });
        const onError = (error: Error) => {
          failure ??= error;
        };
        const cleanup = () => {
          command.signal.removeEventListener("abort", abort);
          readers.forEach((remove) => remove());
          child.off("error", onError);
          child.off("close", close);
        };
        const close = (code: number | null) => {
          resource.closed = true;
          cleanup();
          if (failure) resume(Effect.fail(failure));
          else if (code !== 0)
            resume(
              Effect.fail(
                new Error(
                  `${command.executable} exited ${code}: ${stderr.split("\n").slice(-20).join("\n")}`,
                ),
              ),
            );
          else resume(Effect.succeed({ stdout, stderr }));
        };
        child.on("error", onError);
        child.on("close", close);
        return Effect.sync(cleanup);
      });
      return yield* monitor.pipe(
        Effect.timeoutOrElse({
          duration: command.timeoutMs,
          orElse: () =>
            Effect.fail(new Error("Renderer process deadline exceeded")),
        }),
      );
    }).pipe(Effect.scoped),
  );
