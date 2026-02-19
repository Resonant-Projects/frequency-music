// convex/convex.config.ts
import { defineApp } from "convex/server";
import aggregate from "@convex-dev/aggregate/convex.config";
import actionCache from "@convex-dev/action-cache/convex.config";
import workflow from "@convex-dev/workflow/convex.config";

const app = defineApp();

// Aggregate component - for efficient counts/sums (concept mentions, source stats)
app.use(aggregate);

// Action Cache component - cache expensive AI calls (extractions, generations)
app.use(actionCache);

// Workflow component - durable workflows for extraction pipeline
app.use(workflow);

export default app;
