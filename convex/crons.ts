import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Poll all enabled RSS feeds every 6 hours
crons.interval(
  "poll-feeds",
  { hours: 6 },
  internal.ingest.pollAllFeedsInternal,
);

export default crons;
