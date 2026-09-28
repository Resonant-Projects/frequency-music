// Pull-based, leased job lifecycle. Convex never calls the media service.
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { applyMediaJobResult } from "./mediaJobEffects";
import {
  type ClaimedMediaJob,
  LEASE_MS,
  MAX_ATTEMPTS,
  mediaJobDedupeKey,
  mediaJobInputValidator,
  mediaJobInputZ,
  mediaJobKindZ,
  mediaJobResultValidator,
  mediaJobResultZ,
} from "./shared/mediaJobs";

const SWEEP_LIMIT = 100;

const claimedReturn = v.union(
  v.null(),
  v.object({
    jobId: v.string(),
    kind: v.string(),
    input: mediaJobInputValidator,
    leaseToken: v.string(),
    leaseExpiresAt: v.number(),
    attempts: v.number(),
  }),
);

// Fences every worker write on the lease it was issued: a stale worker whose
// lease expired and was re-claimed no longer holds the token the row carries.
export function requireLease(
  job: Doc<"mediaJobs"> | null,
  leaseToken: string,
  now: number,
): Doc<"mediaJobs"> {
  if (!job) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Media job not found",
    });
  }
  if (job.status !== "claimed" || job.leaseToken !== leaseToken) {
    throw new ConvexError({
      code: "LEASE_MISMATCH",
      message: "Media job lease does not match",
    });
  }
  if ((job.leaseExpiresAt ?? 0) < now) {
    throw new ConvexError({
      code: "LEASE_EXPIRED",
      message: "Media job lease has expired",
    });
  }
  return job;
}

export const enqueue = internalMutation({
  args: { input: mediaJobInputValidator, priority: v.optional(v.number()) },
  returns: v.object({ jobId: v.id("mediaJobs"), created: v.boolean() }),
  handler: async (ctx, args) => {
    const input = mediaJobInputZ.parse(args.input);
    const dedupeKey = mediaJobDedupeKey(input);
    const existing = await ctx.db
      .query("mediaJobs")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "queued"),
          q.eq(q.field("status"), "claimed"),
          q.eq(q.field("status"), "done"),
        ),
      )
      .first();
    if (existing) return { jobId: existing._id, created: false };
    const jobId = await ctx.db.insert("mediaJobs", {
      kind: input.kind,
      input,
      dedupeKey,
      status: "queued",
      priority: args.priority ?? 0,
      attempts: 0,
      createdAt: Date.now(),
    });
    return { jobId, created: true };
  },
});

export const claimNext = internalMutation({
  args: { workerId: v.string(), kinds: v.array(v.string()) },
  returns: claimedReturn,
  handler: async (ctx, args): Promise<ClaimedMediaJob | null> => {
    const kinds = args.kinds.map((kind) => mediaJobKindZ.parse(kind));
    const now = Date.now();
    // Filter by kind before the limit: queued jobs of kinds this worker does
    // not serve must never shadow a claimable one.
    const job = await ctx.db
      .query("mediaJobs")
      .withIndex("by_status_priority_createdAt", (q) =>
        q.eq("status", "queued"),
      )
      .order("asc")
      .filter((q) => q.or(...kinds.map((kind) => q.eq(q.field("kind"), kind))))
      .first();
    if (!job) return null;
    const leaseToken = crypto.randomUUID();
    const leaseExpiresAt = now + LEASE_MS;
    await ctx.db.patch(job._id, {
      status: "claimed",
      leaseToken,
      leaseExpiresAt,
      workerId: args.workerId,
      claimedAt: now,
    });
    return {
      jobId: job._id,
      kind: job.kind as ClaimedMediaJob["kind"],
      input: job.input,
      leaseToken,
      leaseExpiresAt,
      attempts: job.attempts,
    };
  },
});

export const renewLease = internalMutation({
  args: { jobId: v.id("mediaJobs"), leaseToken: v.string() },
  returns: v.object({ leaseExpiresAt: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = requireLease(
      await ctx.db.get(args.jobId),
      args.leaseToken,
      now,
    );
    const leaseExpiresAt = now + LEASE_MS;
    await ctx.db.patch(job._id, { leaseExpiresAt });
    return { leaseExpiresAt };
  },
});

export const complete = internalMutation({
  args: {
    jobId: v.id("mediaJobs"),
    leaseToken: v.string(),
    result: mediaJobResultValidator,
  },
  returns: v.object({
    jobId: v.id("mediaJobs"),
    status: v.literal("done"),
    resultArtifactIds: v.array(v.id("audioArtifacts")),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = await ctx.db.get(args.jobId);
    // Idempotent repeat: same lease, already done → stored result.
    if (job && job.status === "done" && job.leaseToken === args.leaseToken) {
      return {
        jobId: job._id,
        status: "done" as const,
        resultArtifactIds: job.resultArtifactIds ?? [],
      };
    }
    const live = requireLease(job, args.leaseToken, now);
    const result = mediaJobResultZ.parse(args.result);
    if (result.kind !== live.kind) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Result kind does not match job kind",
      });
    }
    const resultArtifactIds = await applyMediaJobResult(ctx, live, result);
    await ctx.db.patch(live._id, {
      status: "done",
      result,
      resultArtifactIds,
      finishedAt: now,
    });
    return { jobId: live._id, status: "done" as const, resultArtifactIds };
  },
});

async function requeueOrPark(
  ctx: MutationCtx,
  job: Doc<"mediaJobs">,
  error: string,
  now: number,
): Promise<{ status: "queued" | "parked"; attempts: number }> {
  const attempts = job.attempts + 1;
  const status = attempts >= MAX_ATTEMPTS ? "parked" : "queued";
  await ctx.db.patch(job._id, {
    status,
    attempts,
    error: error.slice(0, 2000),
    leaseToken: undefined,
    leaseExpiresAt: undefined,
    workerId: undefined,
    ...(status === "parked" ? { finishedAt: now } : {}),
  });
  return { status, attempts };
}

export const fail = internalMutation({
  args: { jobId: v.id("mediaJobs"), leaseToken: v.string(), error: v.string() },
  returns: v.object({
    status: v.union(v.literal("queued"), v.literal("parked")),
    attempts: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = requireLease(
      await ctx.db.get(args.jobId),
      args.leaseToken,
      now,
    );
    return await requeueOrPark(ctx, job, args.error, now);
  },
});

// Expired leases count as attempts (spec §3.3).
export const sweepStale = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.object({ requeued: v.number(), parked: v.number() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const expired = await ctx.db
      .query("mediaJobs")
      .withIndex("by_status_leaseExpiresAt", (q) =>
        q.eq("status", "claimed").lt("leaseExpiresAt", now),
      )
      .take(SWEEP_LIMIT);
    let requeued = 0;
    let parked = 0;
    for (const job of expired) {
      const outcome = await requeueOrPark(ctx, job, "lease expired", now);
      if (outcome.status === "queued") requeued++;
      else parked++;
    }
    return { requeued, parked };
  },
});
