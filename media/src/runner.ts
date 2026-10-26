// One poll iteration: claim → handle → complete/fail. The lease is renewed on
// an interval while the handler runs; the work dir is removed either way.
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ClaimedMediaJob } from "../../convex/shared/mediaJobs";
import { Effect } from "effect";
import { attempt } from "./effects";
import { renewLease, runHandler } from "./jobLifetime";
import type { callTool } from "./convex";
import type { JobHandler, ToolClient } from "./jobs/types";
import { log, redactError } from "./log";
import { retainedKey, readCheckpoint, writeCheckpoint } from "./retained";
import { liveTools } from "./upload";

export type RunnerConfig = {
  workerId: string;
  kinds: string[];
  workDir: string;
  rendererVersion: string;
  deadlineMs?: number; // defaults to JOB_DEADLINE_MS; tests shorten it
  deadlineGraceMs?: number; // defaults to DEADLINE_GRACE_MS; tests shorten it
};
type Tool = typeof callTool;

// Longest a single handler may run; longer than any render we schedule, short
// enough that a hung ffmpeg does not hold a lease all night.
export const JOB_DEADLINE_MS = 30 * 60 * 1000;
// After the deadline aborts a handler, how long to wait for it to settle (a
// killed ffmpeg, an aborted upload) before failing the job and removing the
// work dir. Bounded so a handler that ignores the signal cannot hold the slot.
export const DEADLINE_GRACE_MS = 30 * 1000;

export function runOnceEffect(
  config: RunnerConfig,
  tool: Tool,
  handlers: Record<string, JobHandler>,
  tools?: ToolClient,
) {
  const program = Effect.gen(function* () {
    const job = yield* attempt(() =>
      tool<ClaimedMediaJob | null>("claimNextMediaJob", {
        workerId: config.workerId,
        kinds: config.kinds,
        rendererVersion: config.rendererVersion,
      }),
    );
    if (!job) return "idle" as const;
    log(`claimed ${job.kind} job ${job.jobId} (attempt ${job.attempts + 1})`);
    const abort = new AbortController();
    const stopRenewal = yield* renewLease(job, tool, abort);
    const execute = Effect.gen(function* () {
      const handler = handlers[job.kind];
      if (!handler)
        return yield* Effect.fail(new Error(`no handler for kind ${job.kind}`));
      if (job.input.rendererVersion !== config.rendererVersion) {
        return yield* Effect.fail(
          new Error(
            `renderer version mismatch: job requested ${job.input.rendererVersion}, worker is ${config.rendererVersion}`,
          ),
        );
      }
      const retainedDir = join(
        config.workDir,
        "retained",
        retainedKey({
          jobId: job.jobId,
          rendererVersion: job.input.rendererVersion,
        }),
      );
      if (
        job.attempts > 0 &&
        job.freshStartAllowed !== true &&
        !(yield* attempt(() => readCheckpoint(retainedDir, "started")))
      ) {
        return yield* Effect.fail(
          new Error(
            "Retained job checkpoint missing; automatic recovery cannot safely repeat paid work",
          ),
        );
      }
      yield* attempt(() =>
        writeCheckpoint(
          retainedDir,
          "started",
          { jobId: job.jobId },
          config.workDir,
        ),
      );
      const retainedResult = yield* attempt(() =>
        readCheckpoint<Awaited<ReturnType<JobHandler>>>(retainedDir, "result"),
      );
      if (retainedResult) {
        yield* attempt(() => acknowledgeCompletion(tool, job, retainedResult));
        yield* attempt(() => removeCompletedCheckpoints(retainedDir));
        return "done" as const;
      }
      const workDir = yield* Effect.acquireRelease(
        attempt(() => mkdtemp(join(config.workDir, `${job.kind}-`))),
        (dir) =>
          attempt(() => rm(dir, { recursive: true, force: true })).pipe(
            Effect.orDie,
          ),
      );
      const result = yield* runHandler({
        handler,
        context: {
          job,
          workDir,
          retainedDir,
          retainedRoot: config.workDir,
          tools: tools ?? liveTools(abort.signal),
          rendererVersion: config.rendererVersion,
          signal: abort.signal,
        },
        abort,
        stopRenewal,
        deadlineMs: config.deadlineMs ?? JOB_DEADLINE_MS,
        graceMs: config.deadlineGraceMs ?? DEADLINE_GRACE_MS,
      });
      yield* attempt(() =>
        writeCheckpoint(retainedDir, "result", result, config.workDir),
      );
      yield* attempt(() => acknowledgeCompletion(tool, job, result));
      yield* attempt(() => removeCompletedCheckpoints(retainedDir));
      log(`completed ${job.kind} job ${job.jobId}`);
      return "done" as const;
    });
    return yield* execute.pipe(
      Effect.catch((error) =>
        Effect.gen(function* () {
          const message = redactError(error);
          log(`job ${job.jobId} failed: ${message}`);
          yield* attempt(() =>
            tool("failMediaJob", {
              jobId: job.jobId,
              leaseToken: job.leaseToken,
              error: message,
            }),
          ).pipe(
            Effect.catch((failError) =>
              Effect.sync(() => {
                log(
                  `could not record failure for ${job.jobId}: ${redactError(failError)}`,
                );
              }),
            ),
          );
          return "failed" as const;
        }),
      ),
      Effect.ensuring(stopRenewal),
    );
  }).pipe(Effect.scoped);
  return program;
}

export function runOnce(
  config: RunnerConfig,
  tool: Tool,
  handlers: Record<string, JobHandler>,
  tools?: ToolClient,
): Promise<"idle" | "done" | "failed"> {
  return Effect.runPromise(runOnceEffect(config, tool, handlers, tools));
}

async function acknowledgeCompletion(
  tool: Tool,
  job: ClaimedMediaJob,
  result: Awaited<ReturnType<JobHandler>>,
) {
  const args = { jobId: job.jobId, leaseToken: job.leaseToken, result };
  try {
    await tool("completeMediaJob", args);
  } catch (error) {
    // Completion is idempotent for this lease, including after it expires.
    // Retry only the acknowledgment, never synthesis or upload.
    try {
      await tool("completeMediaJob", args);
    } catch {
      throw error;
    }
  }
}

async function removeCompletedCheckpoints(dir: string) {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch (error) {
    log(`could not remove completed media checkpoints: ${redactError(error)}`);
  }
}
