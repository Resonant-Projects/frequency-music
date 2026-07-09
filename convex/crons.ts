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

export default crons;
