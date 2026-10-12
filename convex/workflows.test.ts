import { describe, expect, test, vi } from "vite-plus/test";
import { getFunctionName } from "convex/server";
import type { WorkflowCtx } from "@convex-dev/workflow";
import {
  countBatchExtractionOutcomes,
  fullPipelineWorkflow,
} from "./workflows";

// Capture the actual definitions at the WorkflowManager boundary.
vi.mock("./components", () => ({
  workflowManager: { define: (definition: unknown) => definition },
}));

describe("batch extraction failure accounting", () => {
  test("counts attempted, succeeded, and failed outcomes", () => {
    expect(countBatchExtractionOutcomes([true, false, true, false])).toEqual({
      attempted: 4,
      succeeded: 2,
      failed: 2,
      allFailed: false,
    });
    expect(countBatchExtractionOutcomes([false, false])).toEqual({
      attempted: 2,
      succeeded: 0,
      failed: 2,
      allFailed: true,
    });
    expect(countBatchExtractionOutcomes([])).toEqual({
      attempted: 0,
      succeeded: 0,
      failed: 0,
      allFailed: false,
    });
  });
});

test("the full pipeline disables extraction retries and continues independent work", async () => {
  const runQuery = vi.fn(async (ref) =>
    getFunctionName(ref) === "sources:listByStatus"
      ? [{ _id: "source-a" }, { _id: "source-b" }]
      : [],
  );
  const runAction = vi.fn(async () => {
    throw new Error("provider unavailable");
  });
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const handler = (
      fullPipelineWorkflow as unknown as {
        handler: (ctx: WorkflowCtx, args: {}) => Promise<void>;
      }
    ).handler;
    await handler({ runQuery, runAction } as unknown as WorkflowCtx, {});
    expect(runAction).toHaveBeenCalledTimes(2);
    for (const call of runAction.mock.calls as unknown as [
      unknown,
      unknown,
      unknown,
    ][]) {
      expect(getFunctionName(call[0] as never)).toBe("extract:extractSource");
      expect(call[2]).toEqual({ retry: false });
    }
    expect(runQuery).toHaveBeenCalledTimes(2);
    expect(getFunctionName(runQuery.mock.calls[1]![0])).toBe(
      "extractions:listRecent",
    );
  } finally {
    error.mockRestore();
  }
});
