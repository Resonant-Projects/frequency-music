import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// Poll all enabled RSS feeds every 6 hours
crons.interval(
  "poll-feeds",
  { hours: 6 },
  internal.ingest.pollAllFeedsInternal,
);

// Generate a weekly turn/brief every Friday.
crons.weekly(
  "generate-weekly-turn",
  { dayOfWeek: "friday", hourUTC: 16, minuteUTC: 0 },
  api.weeklyBriefs.generate,
  { daysBack: 7 },
);

export default crons;
