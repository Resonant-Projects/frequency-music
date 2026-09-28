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
};
type Tool = typeof callTool;

const RENEW_EVERY_MS = Math.floor(LEASE_MS / 3);

export async function runOnce(
  config: RunnerConfig,
  tool: Tool,
  handlers: Record<string, JobHandler>,
  tools: ToolClient = liveTools(),
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
    workDir = await mkdtemp(join(config.workDir, `${job.kind}-`));
    const result = await handler({
      job,
      workDir,
      tools,
      rendererVersion: config.rendererVersion,
    });
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
