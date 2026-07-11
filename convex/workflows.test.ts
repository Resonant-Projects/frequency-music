import { describe, expect, test } from "vite-plus/test";
import { countBatchExtractionOutcomes } from "./workflows";

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
