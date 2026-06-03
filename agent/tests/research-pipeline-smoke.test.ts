import { describe, expect, test } from "bun:test";

import {
  getConvexSiteUrlFromEnv,
  shouldRunResearchPipelineSmoke,
} from "../scripts/smoke-research-pipeline";

describe("research pipeline smoke planning", () => {
  test("requires explicit opt-in by default", () => {
    expect(shouldRunResearchPipelineSmoke({})).toBe(false);
    expect(shouldRunResearchPipelineSmoke({ RUN_RESEARCH_PIPELINE_SMOKE: "false" })).toBe(false);
  });

  test("enables smoke for true-like flags", () => {
    for (const value of ["true", "TRUE", "1", "yes", " Yes "]) {
      expect(shouldRunResearchPipelineSmoke({ RUN_RESEARCH_PIPELINE_SMOKE: value })).toBe(true);
    }
  });

  test("prefers CONVEX_SITE_URL and falls back to Convex URL names", () => {
    expect(getConvexSiteUrlFromEnv({ CONVEX_SITE_URL: "https://site.example" })).toBe(
      "https://site.example",
    );
    expect(getConvexSiteUrlFromEnv({ CONVEX_URL: "https://convex.example" })).toBe(
      "https://convex.example",
    );
    expect(getConvexSiteUrlFromEnv({ CONVEX_SELF_HOSTED_URL: "https://self.example" })).toBe(
      "https://self.example",
    );
  });
});
