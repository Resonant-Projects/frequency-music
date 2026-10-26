import { convexTest } from "convex-test";
import workflow from "@convex-dev/workflow/test";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../modules";

export async function setupOperationRecovery(transactionLimits = false) {
  const t = convexTest({ schema, modules, transactionLimits });
  workflow.register(t);
  const runId = await t.run((ctx) =>
    ctx.db.insert("agentRuns", {
      graphName: "source-scout",
      input: {},
      status: "running",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const input = {
    url: "https://example.org/paper",
    query: "acoustics",
    rationale: "Missing evidence",
    rawText: "Retained capture",
  };
  const failureId = await t.mutation(
    internal.operationFailures.reportCaptureFailure,
    { agentRunId: runId, input, stage: "intake" },
  );
  const due = () =>
    t.run((ctx) => ctx.db.patch(failureId, { nextAttemptAt: 0 }));
  return { t, runId, input, failureId, due };
}
