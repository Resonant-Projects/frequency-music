// One poll iteration: claim → handle → complete/fail. The lease is renewed on
// an interval while the handler runs; the work dir is removed either way.
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ClaimedMediaJob } from "../../convex/shared/mediaJobs";
import { LEASE_MS } from "../../convex/shared/mediaJobs";
import type { callTool } from "./convex";
import type { JobHandler, ToolClient } from "./jobs/types";
import { log, redactError } from "./log";
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

const RENEW_EVERY_MS = Math.floor(LEASE_MS / 3);
// Longest a single handler may run; longer than any render we schedule, short
// enough that a hung ffmpeg does not hold a lease all night.
export const JOB_DEADLINE_MS = 30 * 60 * 1000;
// After the deadline aborts a handler, how long to wait for it to settle (a
// killed ffmpeg, an aborted upload) before failing the job and removing the
// work dir. Bounded so a handler that ignores the signal cannot hold the slot.
export const DEADLINE_GRACE_MS = 30 * 1000;

export async function runOnce(
  config: RunnerConfig,
  tool: Tool,
  handlers: Record<string, JobHandler>,
  // Tests inject fakes; production builds the live client on the job's
  // abort signal once the controller exists.
  tools?: ToolClient,
): Promise<"idle" | "done" | "failed"> {
  const job = await tool<ClaimedMediaJob | null>("claimNextMediaJob", {
    workerId: config.workerId,
    kinds: config.kinds,
  });
  if (!job) return "idle";
  log(`claimed ${job.kind} job ${job.jobId} (attempt ${job.attempts + 1})`);
  // Scratch-dir creation sits inside the failure path: if it throws, the job
  // is failed promptly instead of waiting out its lease.
  let workDir: string | undefined;
  const renew = setInterval(() => {
    tool("renewMediaJobLease", {
      jobId: job.jobId,
      leaseToken: job.leaseToken,
    }).catch((error) =>
      log(`lease renewal failed for ${job.jobId}: ${redactError(error)}`),
    );
  }, RENEW_EVERY_MS);
  try {
    const handler = handlers[job.kind];
    if (!handler) throw new Error(`no handler for kind ${job.kind}`);
    // The dedupe key and the result's provenance both name the renderer
    // version, so a job addressed to another version is failed, not rendered.
    if (job.input.rendererVersion !== config.rendererVersion) {
      throw new Error(
        `renderer version mismatch: job requested ${job.input.rendererVersion}, worker is ${config.rendererVersion}`,
      );
    }
    workDir = await mkdtemp(join(config.workDir, `${job.kind}-`));
    const deadlineMs = config.deadlineMs ?? JOB_DEADLINE_MS;
    const deadlineGraceMs = config.deadlineGraceMs ?? DEADLINE_GRACE_MS;
    const abort = new AbortController();
    let deadline: NodeJS.Timeout | undefined;
    const expired = new Promise<never>((_, reject) => {
      deadline = setTimeout(() => {
        // Stop renewing so the lease can lapse if the handler is truly hung,
        // and abort so a running ffmpeg or upload is killed rather than left
        // to race the next attempt over the deleted work dir.
        clearInterval(renew);
        const error = new Error(`job deadline exceeded after ${deadlineMs} ms`);
        // Reject first: abort listeners run synchronously and could otherwise
        // settle the race with the handler's own error instead of the deadline.
        reject(error);
        abort.abort(error);
      }, deadlineMs);
    });
    let result: Awaited<ReturnType<JobHandler>>;
    let running: ReturnType<JobHandler> | undefined;
    try {
      running = handler({
        job,
        workDir,
        tools: tools ?? liveTools(abort.signal),
        rendererVersion: config.rendererVersion,
        signal: abort.signal,
      });
      result = await Promise.race([running, expired]);
    } catch (error) {
      if (abort.signal.aborted && running) {
        // Give the aborted handler a bounded window to settle before the
        // failure is recorded and the work dir is removed.
        let grace: NodeJS.Timeout | undefined;
        await Promise.race([
          running.catch(() => undefined),
          new Promise<void>((resolve) => {
            grace = setTimeout(resolve, deadlineGraceMs);
          }),
        ]);
        clearTimeout(grace);
      }
      throw error;
    } finally {
      clearTimeout(deadline);
    }
    await tool("completeMediaJob", {
      jobId: job.jobId,
      leaseToken: job.leaseToken,
      result,
    });
    log(`completed ${job.kind} job ${job.jobId}`);
    return "done";
  } catch (error) {
    const message = redactError(error);
    log(`job ${job.jobId} failed: ${message}`);
    try {
      await tool("failMediaJob", {
        jobId: job.jobId,
        leaseToken: job.leaseToken,
        error: message,
      });
    } catch (failError) {
      log(
        `could not record failure for ${job.jobId}: ${redactError(failError)}`,
      );
    }
    return "failed";
  } finally {
    clearInterval(renew);
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }
}
