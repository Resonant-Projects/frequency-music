import { v } from "convex/values";
import { zodToConvex } from "convex-helpers/server/zod4";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAuth } from "./auth";
import {
  looksLikeBotChallenge,
  SCOUTED_TEXT_MIN_CHARS,
} from "./shared/agentContract";
import { generateDedupeKey } from "./sourceUtils";
import { insertQueuedRun } from "./agentRuns";
import {
  captureInputZ,
  diagnosisZ,
  failureStatusValidator,
  MAX_GROUP_FAILURES,
  MAX_RECOVERY_ATTEMPTS,
  type RecoveryTarget,
} from "./shared/operationRecovery";
import { redactError } from "./shared/redactError";
import { fnv1a64Hex } from "./shared/stableHash";
import { truncateText } from "./shared/truncateText";
import { failureCause } from "./shared/failureCause";
import { extractionSnapshotMatchesSource } from "./shared/extractionPrompt";

/** Server-derived operation identity makes delivery retries harmless. */
export async function recordOperationFailure(
  ctx: MutationCtx,
  args: {
    operationId: string;
    causeKey: string;
    target: RecoveryTarget;
    message: string;
    agentRunId?: Id<"agentRuns">;
  },
): Promise<Id<"operationFailures">> {
  const previous = await ctx.db
    .query("operationFailures")
    .withIndex("by_operation", (q) => q.eq("operationId", args.operationId))
    .unique();
  if (previous) return previous._id;
  const now = Date.now();
  const id = await ctx.db.insert("operationFailures", {
    ...args,
    captureDedupeKey:
      args.target.kind === "capture"
        ? generateDedupeKey("url", { canonicalUrl: args.target.input.url })
        : undefined,
    message: truncateText(args.message, 1000),
    status: "recorded",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now + 30_000,
  });
  await ctx.scheduler.runAfter(30_000, internal.recoveryWorkflows.start, {
    failureId: id,
  });
  return id;
}

/** A successful operation settles its failure even when an operator resumed it. */
export async function resolveOperationFailure(
  ctx: MutationCtx,
  operationId: string,
) {
  const failure = await ctx.db
    .query("operationFailures")
    .withIndex("by_operation", (q) => q.eq("operationId", operationId))
    .unique();
  if (failure && failure.status !== "resolved")
    await ctx.db.patch(failure._id, {
      status: "resolved",
      updatedAt: Date.now(),
    });
}

/** A newly retained result changes recovery from generation to bounded completion replay. */
export async function reopenExtractionCompletionRecovery(
  ctx: MutationCtx,
  attemptId: Id<"extractionAttempts">,
) {
  const failure = await ctx.db
    .query("operationFailures")
    .withIndex("by_operation", (q) =>
      q.eq("operationId", `extraction:${attemptId}`),
    )
    .unique();
  if (
    !failure ||
    !["recorded", "investigating", "needsReview"].includes(failure.status) ||
    failure.attempts >= MAX_RECOVERY_ATTEMPTS
  )
    return;
  await ctx.db.patch(failure._id, {
    status: "recorded",
    // The server has retained output; replay cannot invoke generation.
    diagnosis:
      "Retained output available; replay completion without generation",
    investigationRunId: undefined,
    updatedAt: Date.now(),
    nextAttemptAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.recoveryWorkflows.start, {
    failureId: failure._id,
  });
}

/** Canonical intake settles prior failures in bounded transactions, including open investigations. */
export async function settleCaptureFailures(
  ctx: MutationCtx,
  args: { dedupeKey: string; capturedAt: number },
) {
  let changed = false;
  for (const status of [
    "recorded",
    "retrying",
    "recovering",
    "investigating",
    "needsReview",
  ] as const) {
    const rows = await ctx.db
      .query("operationFailures")
      .withIndex("by_capture_status_created", (q) =>
        q
          .eq("captureDedupeKey", args.dedupeKey)
          .eq("status", status)
          .lte("createdAt", args.capturedAt),
      )
      .take(1);
    for (const row of rows) {
      await ctx.db.patch(row._id, {
        status: "resolved",
        updatedAt: Date.now(),
      });
      changed = true;
    }
  }
  if (changed)
    await ctx.scheduler.runAfter(
      0,
      internal.operationFailures.settleCaptured,
      args,
    );
}

export const settleCaptured = internalMutation({
  args: { dedupeKey: v.string(), capturedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Intake may have been reset while this bounded continuation was queued.
    if (await captureCompleteForKey(ctx, args.dedupeKey))
      await settleCaptureFailures(ctx, args);
    return null;
  },
});

function captureAlreadyComplete(ctx: Pick<QueryCtx, "db">, url: string) {
  return captureCompleteForKey(
    ctx,
    generateDedupeKey("url", { canonicalUrl: url }),
  );
}

async function captureCompleteForKey(ctx: Pick<QueryCtx, "db">, key: string) {
  const source = await ctx.db
    .query("sources")
    .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", key))
    .first();
  const text = source?.rawText?.trim();
  return (
    !!text &&
    text.length >= SCOUTED_TEXT_MIN_CHARS &&
    !looksLikeBotChallenge(text)
  );
}

export const reportCaptureFailure = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    input: zodToConvex(captureInputZ),
    stage: v.union(v.literal("capture"), v.literal("intake")),
    diagnostic: v.optional(v.string()),
  },
  returns: v.id("operationFailures"),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.agentRunId);
    if (!run || run.graphName !== "source-scout")
      throw new Error("Source Scout provenance required");
    const input = args.input;
    const operationId = `capture:${args.agentRunId}:${fnv1a64Hex(input.url)}`;
    const message = args.diagnostic
      ? redactError(args.diagnostic)
      : `Source Scout ${args.stage} failed`;
    const failureId = await recordOperationFailure(ctx, {
      operationId,
      causeKey: `capture:${new URL(input.url).hostname}:${failureCause(message)}:${args.stage}`,
      target: { kind: "capture", input },
      message,
      agentRunId: args.agentRunId,
    });
    // A late reporter must not reopen recovery after another Scout captured the URL.
    if (await captureAlreadyComplete(ctx, input.url))
      await resolveOperationFailure(ctx, operationId);
    return failureId;
  },
});

async function unsupportedRecovery(
  ctx: Pick<QueryCtx, "db">,
  failure: Doc<"operationFailures">,
): Promise<string | undefined> {
  if (failure.target.kind === "audioUpload") {
    const job = await ctx.db.get(failure.target.jobId);
    return mediaRecoveryConstraint(job);
  }
  if (failure.target.kind === "extraction") {
    const attempt = await ctx.db.get(failure.target.attemptId);
    const source =
      attempt && !attempt.result ? await ctx.db.get(attempt.sourceId) : null;
    return extractionRecoveryConstraint(attempt, source);
  }
  return undefined;
}

function mediaRecoveryConstraint(job: Doc<"mediaJobs"> | null) {
  if (!job) return "Media job no longer exists";
  if (job.input.rendererVersion.startsWith("essay-"))
    return "Operator renderer must resume its retained local audio";
  if (
    /renderer version mismatch|checkpoint missing|checksum mismatch|over the .*upload cap|no handler for kind/i.test(
      job.error ?? "",
    )
  )
    return "Media prerequisites require operator review";
  return undefined;
}

async function extractionRecoveryConstraint(
  attempt: Doc<"extractionAttempts"> | null,
  source: Doc<"sources"> | null,
) {
  if (!attempt) return "Extraction snapshot no longer exists";
  if (
    !attempt.result &&
    (attempt.origin === "operator" ||
      !source ||
      source.status === "archived" ||
      !(await extractionSnapshotMatchesSource(attempt, source)))
  )
    return "Only retained output can complete this snapshot";
  return undefined;
}

async function investigate(
  ctx: MutationCtx,
  failure: Doc<"operationFailures">,
) {
  const groups = await ctx.db
    .query("failureInvestigationGroups")
    .withIndex("by_cause_slots", (q) =>
      q.eq("causeKey", failure.causeKey).gt("openSlots", 0),
    )
    .take(20);
  let investigationRunId: Id<"agentRuns"> | undefined;
  for (const group of groups) {
    const run = await ctx.db.get(group.runId);
    // Once a run starts, its evidence membership is frozen.
    if (run?.status !== "queued") {
      await ctx.db.patch(group._id, { openSlots: 0 });
      continue;
    }
    investigationRunId = run._id;
    await ctx.db.patch(group._id, { openSlots: group.openSlots - 1 });
    break;
  }
  if (!investigationRunId) {
    ({ runId: investigationRunId } = await insertQueuedRun(ctx, {
      graphName: "failure-investigation",
    }));
    await ctx.db.insert("failureInvestigationGroups", {
      causeKey: failure.causeKey,
      runId: investigationRunId,
      openSlots: MAX_GROUP_FAILURES - 1,
    });
  }
  await ctx.db.patch(failure._id, {
    status: "investigating",
    investigationRunId,
    updatedAt: Date.now(),
    nextAttemptAt: Date.now() + 60 * 60_000,
  });
}

export const claimRecovery = internalMutation({
  args: { failureId: v.id("operationFailures") },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, { failureId }) => {
    const failure = await ctx.db.get(failureId);
    if (
      !failure ||
      failure.status !== "recorded" ||
      failure.nextAttemptAt > Date.now()
    )
      return null;
    if (
      failure.target.kind === "capture" &&
      (await captureAlreadyComplete(ctx, failure.target.input.url))
    ) {
      await resolveOperationFailure(ctx, failure.operationId);
      return null;
    }
    if (failure.attempts >= MAX_RECOVERY_ATTEMPTS) {
      await ctx.db.patch(failureId, {
        status: "needsReview",
        updatedAt: Date.now(),
      });
      return null;
    }
    // Two transient retries precede diagnosis; a supported diagnosis permits one final action.
    const blocked = await unsupportedRecovery(ctx, failure);
    if (blocked && failure.target.kind === "extraction") {
      // Obsolete inputs cannot benefit from paid investigation or generation.
      await ctx.runMutation(internal.extractInternal.releaseObsoleteRecovery, {
        attemptId: failure.target.attemptId,
      });
      await ctx.db.patch(failureId, {
        status: "needsReview",
        diagnosis: `Recovery withheld: ${blocked}`,
        updatedAt: Date.now(),
      });
      return null;
    }
    if (
      blocked ||
      ((failure.attempts >= 2 || failure.target.kind === "audioUpload") &&
        !failure.diagnosis)
    ) {
      await investigate(ctx, failure);
      return null;
    }
    await ctx.db.patch(failureId, {
      status: "retrying",
      recoveryRunId: undefined,
      attempts: failure.attempts + 1,
      updatedAt: Date.now(),
      nextAttemptAt: Date.now() + 60 * 60_000,
    });
    return failure.attempts + 1;
  },
});
export const getForRecovery = internalQuery({
  args: { failureId: v.id("operationFailures") },
  handler: (ctx, { failureId }) => ctx.db.get(failureId),
});

export async function finishRecovery(
  ctx: MutationCtx,
  failureId: Id<"operationFailures">,
  success: boolean,
  attempt?: number,
) {
  const failure = await ctx.db.get(failureId);
  if (
    !failure ||
    (attempt !== undefined && failure.attempts !== attempt) ||
    !["retrying", "recovering"].includes(failure.status)
  )
    return;
  const status = success
    ? "resolved"
    : failure.attempts >= MAX_RECOVERY_ATTEMPTS
      ? "needsReview"
      : "recorded";
  await ctx.db.patch(failureId, {
    status,
    updatedAt: Date.now(),
    nextAttemptAt: Date.now() + 60_000 * 2 ** failure.attempts,
  });
}
export const finish = internalMutation({
  args: {
    failureId: v.id("operationFailures"),
    success: v.boolean(),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await finishRecovery(ctx, args.failureId, args.success, args.attempt);
    return null;
  },
});
export const dispatch = internalMutation({
  args: { failureId: v.id("operationFailures"), attempt: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { failureId, attempt }) => {
    const failure = await ctx.db.get(failureId);
    if (
      !failure ||
      failure.status !== "retrying" ||
      failure.attempts !== attempt
    )
      return false;
    if (failure.target.kind === "capture") {
      const { runId } = await insertQueuedRun(ctx, {
        graphName: "source-scout",
        input: { recoveryFailureId: failureId },
      });
      await ctx.db.patch(failureId, {
        status: "recovering",
        recoveryRunId: runId,
        updatedAt: Date.now(),
      });
      return true;
    }
    if (failure.target.kind === "audioUpload") {
      const job = await ctx.db.get(failure.target.jobId);
      if (job?.status === "done") {
        await finishRecovery(ctx, failureId, true);
        return true;
      }
      // An active job already has an owner. Never steal its lease.
      if (job?.status !== "parked" && job?.status !== "failed") return false;
      await ctx.db.patch(job._id, {
        status: "queued",
        finishedAt: undefined,
        error: undefined,
      });
      await ctx.db.patch(failureId, {
        status: "recovering",
        updatedAt: Date.now(),
        nextAttemptAt: Date.now() + 60_000,
      });
      await ctx.scheduler.runAfter(
        60_000,
        internal.operationFailures.reconcile,
        {},
      );
      return true;
    }
    return false;
  },
});

/** Failures frozen into a running investigation; only that run may read or diagnose them. */
async function assignedFailures(
  ctx: Pick<QueryCtx, "db">,
  agentRunId: Id<"agentRuns">,
) {
  const run = await ctx.db.get(agentRunId);
  if (
    !run ||
    run.graphName !== "failure-investigation" ||
    run.status !== "running"
  )
    throw new Error("Active investigation required");
  return ctx.db
    .query("operationFailures")
    .withIndex("by_investigation", (q) =>
      q.eq("investigationRunId", agentRunId),
    )
    .filter((q) => q.eq(q.field("status"), "investigating"))
    .take(MAX_GROUP_FAILURES);
}

export const getInvestigation = internalQuery({
  args: { agentRunId: v.id("agentRuns") },
  handler: async (ctx, { agentRunId }) => {
    const rows = await assignedFailures(ctx, agentRunId);
    return Promise.all(
      rows.map(async (row) => {
        let evidence: Record<string, unknown>;
        let unsupportedReason: string | undefined;
        if (row.target.kind === "extraction") {
          const attempt = await ctx.db.get(row.target.attemptId);
          const source = attempt ? await ctx.db.get(attempt.sourceId) : null;
          unsupportedReason = await extractionRecoveryConstraint(
            attempt,
            source,
          );
          evidence = {
            attemptStatus: attempt?.status,
            retainedResult: !!attempt?.result,
            model: attempt?.model,
            error: attempt?.error ? redactError(attempt.error) : undefined,
            sourceStatus: source?.status,
            currentSnapshot: source?.activeExtractionAttemptId === attempt?._id,
          };
        } else if (row.target.kind === "audioUpload") {
          const job = await ctx.db.get(row.target.jobId);
          unsupportedReason = mediaRecoveryConstraint(job);
          evidence = {
            jobStatus: job?.status,
            jobKind: job?.kind,
            rendererVersion: job?.input.rendererVersion,
            failedAttempts: job?.attempts,
            error: job?.error ? redactError(job.error) : undefined,
            recoveryConstraint:
              "Retry uses worker-local retained chunks and completion checkpoints. Missing or corrupt retained outputs require review.",
          };
        } else {
          evidence = {
            host: new URL(row.target.input.url).hostname,
            retainedText: !!row.target.input.rawText,
            provider: row.target.input.contentProvider,
            stage: row.causeKey.split(":").at(-1),
          };
        }
        return {
          id: row._id,
          operation: row.target.kind,
          cause: row.causeKey,
          message: row.message,
          attempts: row.attempts,
          evidence,
          unsupportedReason,
        };
      }),
    );
  },
});
export const submitDiagnosis = internalMutation({
  args: { agentRunId: v.id("agentRuns"), result: zodToConvex(diagnosisZ) },
  returns: v.null(),
  handler: async (ctx, { agentRunId, result }) => {
    const failures = await assignedFailures(ctx, agentRunId);
    for (const failure of failures) {
      if (failure.status !== "investigating") continue;
      const blocked = await unsupportedRecovery(ctx, failure);
      if (blocked && failure.target.kind === "extraction")
        await ctx.runMutation(
          internal.extractInternal.releaseObsoleteRecovery,
          { attemptId: failure.target.attemptId },
        );
      const retry =
        result.recover && !blocked && failure.attempts < MAX_RECOVERY_ATTEMPTS;
      await ctx.db.patch(failure._id, {
        diagnosis: blocked
          ? `${result.diagnosis}\nRecovery withheld: ${blocked}`
          : result.diagnosis,
        status: retry ? "recorded" : "needsReview",
        nextAttemptAt: Date.now(),
        updatedAt: Date.now(),
      });
      if (retry)
        await ctx.scheduler.runAfter(0, internal.recoveryWorkflows.start, {
          failureId: failure._id,
        });
    }
    return null;
  },
});
export const getCaptureRecovery = internalQuery({
  args: { agentRunId: v.id("agentRuns") },
  handler: async (ctx, { agentRunId }) => {
    const run = await ctx.db.get(agentRunId);
    if (!run || run.graphName !== "source-scout" || run.status !== "running")
      throw new Error("Active Source Scout required");
    const failureId = (
      run.input as { recoveryFailureId?: Id<"operationFailures"> }
    )?.recoveryFailureId;
    if (!failureId) return null;
    const failure = await ctx.db.get(failureId);
    if (
      failure?.target.kind !== "capture" ||
      failure.recoveryRunId !== agentRunId ||
      failure.status !== "recovering"
    )
      return null;
    // A queued run may start before bounded settlement has reached this row.
    if (await captureAlreadyComplete(ctx, failure.target.input.url))
      return null;
    return { failureId, input: failure.target.input };
  },
});
export const finishCaptureRecovery = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    failureId: v.id("operationFailures"),
    success: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const failure = await ctx.db.get(args.failureId);
    const run = await ctx.db.get(args.agentRunId);
    if (
      failure?.recoveryRunId !== args.agentRunId ||
      run?.status !== "running" ||
      run.graphName !== "source-scout"
    )
      throw new Error("Recovery run does not own this attempt");
    await finishRecovery(ctx, args.failureId, args.success);
    return null;
  },
});

/** Bounded reconciliation also catches workflow/worker crashes without recursive investigations. */
export const reconcile = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Each queue may load a full failure and a full job/run snapshot. Keep
    // independent queues inside one transaction even near document limits.
    for (const status of [
      "recorded",
      "retrying",
      "investigating",
      "recovering",
    ] as const) {
      const rows = await ctx.db
        .query("operationFailures")
        .withIndex("by_status_due", (q) =>
          q.eq("status", status).lte("nextAttemptAt", Date.now()),
        )
        .take(1);
      for (const row of rows) {
        if (status === "recorded") {
          await ctx.scheduler.runAfter(0, internal.recoveryWorkflows.start, {
            failureId: row._id,
          });
          continue;
        }
        let active = false;
        let succeeded = false;
        if (status === "investigating") {
          const run = row.investigationRunId
            ? await ctx.db.get(row.investigationRunId)
            : null;
          active = !!run && ["queued", "running"].includes(run.status);
        } else if (
          status === "recovering" &&
          row.target.kind === "audioUpload"
        ) {
          const job = await ctx.db.get(row.target.jobId);
          active = !!job && ["queued", "claimed"].includes(job.status);
          succeeded = job?.status === "done";
        } else if (status === "recovering" && row.recoveryRunId) {
          const run = await ctx.db.get(row.recoveryRunId);
          active = !!run && ["queued", "running"].includes(run.status);
        }
        // Active rows move their next check so they cannot hide later terminal rows.
        if (active) {
          await ctx.db.patch(row._id, {
            nextAttemptAt: Date.now() + 5 * 60_000,
          });
          continue;
        }
        if (status === "investigating")
          await ctx.db.patch(row._id, {
            status: "needsReview",
            diagnosis:
              row.diagnosis ??
              "Investigation did not complete; inspect its Agent Run.",
            updatedAt: Date.now(),
          });
        else await finishRecovery(ctx, row._id, succeeded);
      }
    }
    return null;
  },
});
export const listForRun = query({
  returns: v.array(
    v.object({
      _id: v.id("operationFailures"),
      _creationTime: v.number(),
      operationId: v.string(),
      causeKey: v.string(),
      agentRunId: v.optional(v.id("agentRuns")),
      status: failureStatusValidator,
      message: v.string(),
      diagnosis: v.optional(v.string()),
      attempts: v.number(),
      investigationRunId: v.optional(v.id("agentRuns")),
      recoveryRunId: v.optional(v.id("agentRuns")),
      nextAttemptAt: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  args: {
    agentRunId: v.id("agentRuns"),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const reported = await ctx.db
      .query("operationFailures")
      .withIndex("by_agent_run", (q) => q.eq("agentRunId", args.agentRunId))
      .take(50);
    const investigated = await ctx.db
      .query("operationFailures")
      .withIndex("by_investigation", (q) =>
        q.eq("investigationRunId", args.agentRunId),
      )
      .take(50);
    const recovered = await ctx.db
      .query("operationFailures")
      .withIndex("by_recovery_run", (q) =>
        q.eq("recoveryRunId", args.agentRunId),
      )
      .take(50);
    return [
      ...new Map(
        [...reported, ...investigated, ...recovered].map((row) => [
          row._id,
          row,
        ]),
      ).values(),
    ].map(({ target: _target, captureDedupeKey: _captureKey, ...row }) => row);
  },
});
