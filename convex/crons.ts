import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Poll all enabled RSS feeds every 6 hours
crons.interval(
  "poll-feeds",
  { hours: 6 },
  internal.ingest.pollAllFeedsInternal,
);

// Extract & analyze: run batch extraction every 8 hours (3 sources per run)
// Uses @convex-dev/workflow so each extraction step has its own timeout + retries
crons.interval(
  "batch-extract",
  { hours: 8 },
  internal.workflows.startBatchExtractionInternal,
  {
    limit: 3,
  },
);

// Generate a small batch of hypotheses from fresh, unlinked extractions weekly.
crons.weekly(
  "generate-hypotheses",
  { dayOfWeek: "monday", hourUTC: 16, minuteUTC: 0 },
  internal.workflows.startBatchHypothesisInternal,
  { limit: 3 },
);

// Generate a weekly turn/brief every Friday.
crons.weekly(
  "generate-weekly-turn",
  { dayOfWeek: "friday", hourUTC: 16, minuteUTC: 0 },
  internal.weeklyBriefs.generateInternal,
  { daysBack: 7 },
);

// Fail runs whose worker crashed (no events within the stale window) so a dead
// worker never wedges the queue.
crons.interval(
  "sweep-stale-agent-runs",
  { minutes: 15 },
  internal.agentRuns.sweepStaleRuns,
  {},
);

// Close needs_review runs whose drafts are all resolved (or that never got a
// draft written) so a run can't wedge in needs_review forever. See plan 013.
crons.interval(
  "reconcile-reviewed-agent-runs",
  { minutes: 15 },
  internal.agentRuns.reconcileReviewedRuns,
  {},
);

// Refresh dashboard/inbox row counts (see plans/005) so hot queries never full-scan
crons.interval(
  "recompute-stats",
  { minutes: 30 },
  internal.dashboard.recomputeStats,
  {},
);

// Retry unreviewed concepts older than an hour in case creation scheduling failed.
crons.interval(
  "classify-stale-concepts",
  { hours: 1 },
  internal.conceptClassifier.sweepUnreviewedConcepts,
  {},
);

// Repair missing or stale embeddings without blocking write paths.
crons.weekly(
  "embed-missing-sweep",
  { dayOfWeek: "sunday", hourUTC: 15, minuteUTC: 0 },
  internal.embeddings.sweepMissingEmbeddings,
  {},
);

// Park unresolved conjectures that have shown no evidence or movement in 90 days.
crons.weekly(
  "retire-stale-correspondences",
  { dayOfWeek: "sunday", hourUTC: 16, minuteUTC: 0 },
  internal.correspondences.autoRetireStale,
  {},
);

export default crons;
