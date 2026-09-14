#!/usr/bin/env node
// No env-file loading. Only the inspected subprocess is given the inherited key.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const failure = (code) => ({ complete: false, code });

/** Supervise one subprocess with a wall-clock timer independent of its event loop.
 * No child output is released until successful exit and envelope validation.
 * Exported only for synthetic process tests; the CLI command/limits are fixed.
 */
export function supervise(command, args, options = {}) {
  const {
    cwd,
    env,
    deadlineMs = 30_000,
    maxBytes = 16 * 1024 * 1024,
  } = options;
  return new Promise((accept) => {
    const started = performance.now();
    let settled = false;
    let bytes = 0;
    const chunks = [];
    let child;
    const stop = () => {
      if (!child?.pid || child.exitCode !== null || child.signalCode !== null)
        return;
      try {
        // Detached POSIX group also contains the tsx loader's descendants.
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // Never fall back to a numeric PID that may already have exited.
      }
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.off("SIGTERM", interrupted);
      process.off("SIGINT", interrupted);
      process.off("SIGHUP", interrupted);
      stop();
      child?.stdout?.destroy();
      child?.stderr?.destroy();
      child?.unref();
      accept(result);
    };
    const interrupted = () => finish({ error: failure("capture_interrupted") });
    process.on("SIGTERM", interrupted);
    process.on("SIGINT", interrupted);
    process.on("SIGHUP", interrupted);
    const timer = setTimeout(
      () => finish({ error: failure("capture_deadline") }),
      deadlineMs,
    );
    try {
      child = spawn(command, args, {
        cwd,
        env,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      finish({ error: failure("capture_start_failed") });
      return;
    }
    child.on("error", () => finish({ error: failure("capture_start_failed") }));
    child.stderr.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) finish({ error: failure("capture_output_limit") });
      // Discard, never forward backend/loader messages.
    });
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) finish({ error: failure("capture_output_limit") });
      else chunks.push(chunk);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      if (performance.now() - started >= deadlineMs) {
        finish({ error: failure("capture_deadline") });
        return;
      }
      if (code !== 0 || signal) {
        finish({ error: failure("capture_child_failed") });
        return;
      }
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        const result = JSON.parse(text);
        if (
          result?.format !== "frequency-deployment-inspection-v1" ||
          result.deploymentAuthorized !== false ||
          !Number.isFinite(Date.parse(result.startedAt)) ||
          !Number.isFinite(Date.parse(result.finishedAt)) ||
          result.consistency !== "separate-query-snapshots-not-atomic" ||
          result.functionValidatorsIncluded !== false ||
          result.cronSpecsIncluded !== false ||
          result.cronSchedulesAndTargetsIncluded !== true ||
          result.componentArgumentsIncluded !== false ||
          result.schemaStructuralDeltaIncluded !== false ||
          !Array.isArray(result.components) ||
          !Array.isArray(result.modules) ||
          !Array.isArray(result.schemas)
        )
          throw new Error("Invalid inspection envelope");
        finish(
          performance.now() - started >= deadlineMs
            ? { error: failure("capture_deadline") }
            : { output: text },
        );
      } catch {
        finish({ error: failure("capture_invalid_output") });
      }
    });
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const key = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;
  if (process.argv.length !== 2 || !key || process.platform === "win32") {
    console.error(JSON.stringify(failure("capture_invalid_input")));
    process.exitCode = 1;
  } else {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const result = await supervise(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/convex-deployment-inspect.ts",
        "https://convex.resonantprojects.art",
      ],
      {
        cwd: root,
        env: {
          PATH: process.env.PATH ?? "",
          CONVEX_SELF_HOSTED_ADMIN_KEY: key,
        },
      },
    );
    if (result.error) {
      console.error(JSON.stringify(result.error));
      process.exitCode = 1;
    } else {
      process.stdout.write(result.output);
    }
  }
}
