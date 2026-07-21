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

// Mine new cross-domain correspondence candidates daily. The production worker
// claims this audit row and owns execution under the normal lease contract.
crons.daily(
  "enqueue-correspondence-miner",
  { hourUTC: 5, minuteUTC: 0 },
  internal.agentRuns.enqueue,
  { graphName: "correspondence-miner", input: { limit: 20 } },
);

// Hunt evidence after the miner window, offset so the single worker does not
// receive both daily graph runs at the same instant.
crons.daily(
  "enqueue-evidence-hunter",
  { hourUTC: 6, minuteUTC: 0 },
  internal.agentRuns.enqueue,
  { graphName: "evidence-hunter", input: { limit: 5 } },
);

// Draft one correspondence-driven hypothesis before the Friday brief. The graph
// exits cleanly when the three-slot human-review queue is full.
crons.weekly(
  "enqueue-hypothesis-drafter",
  { dayOfWeek: "thursday", hourUTC: 16, minuteUTC: 0 },
  internal.agentRuns.enqueue,
  { graphName: "hypothesis-drafter", input: {} },
);

// Scout graph gaps before the drafting/brief window, offset from daily agents.
crons.weekly(
  "enqueue-source-scout",
  { dayOfWeek: "wednesday", hourUTC: 16, minuteUTC: 0 },
  internal.agentRuns.enqueue,
  { graphName: "source-scout", input: {} },
);

export default crons;
