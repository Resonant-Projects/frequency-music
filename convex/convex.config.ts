// convex/convex.config.ts

import actionCache from "@convex-dev/action-cache/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";
import rag from "@convex-dev/rag/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();

// Aggregate component - for efficient counts/sums (concept mentions, source stats)
app.use(aggregate);

// Action Cache component - cache expensive AI calls (extractions, generations)
app.use(actionCache);

// Workflow component - durable workflows for extraction pipeline
app.use(workflow);

// RAG component - passage index over full source text (ADR 0001)
app.use(rag);

export default app;
