import { describe, expect, test } from "bun:test";

import {
  buildNeedsReviewDraft,
  finalizeRunNode,
  shouldRunResearchPipelineRealMode,
} from "../scripts/smoke-research-pipeline";

describe("research pipeline real dry-run mode", () => {
  test("requires explicit opt-in for non-smoke runs", () => {
    expect(shouldRunResearchPipelineRealMode({})).toBe(false);
    expect(
      shouldRunResearchPipelineRealMode({
        RUN_RESEARCH_PIPELINE_REAL: "false",
      }),
    ).toBe(false);

    for (const value of ["true", "TRUE", "1", "yes", " Yes "]) {
      expect(
        shouldRunResearchPipelineRealMode({
          RUN_RESEARCH_PIPELINE_REAL: value,
        }),
      ).toBe(true);
    }
  });

  test("finalizing a real dry-run preserves the needs-review draft", async () => {
    const draft = buildNeedsReviewDraft({
      selectedCandidate: {
        id: "extraction-123",
        kind: "extraction",
        route: "hypothesize",
        reason: "Recent extraction has 4 claims and 2 composition parameters.",
        score: 86,
      },
      candidates: [],
    });

    const update = await finalizeRunNode({
      runId: undefined,
      agentRunId: undefined,
      dryRun: true,
      smokeMode: false,
      limit: 5,
      activeTheses: [],
      recentExtractions: [],
      recentHypotheses: [],
      recentRecipes: [],
      failureArchive: [],
      editorialSignals: [],
      recommendedActions: [],
      candidates: [
        {
          id: "extraction-123",
          kind: "extraction",
          route: "hypothesize",
          reason: "reason",
          score: 86,
        },
      ],
      selectedCandidate: {
        id: "extraction-123",
        kind: "extraction",
        route: "hypothesize",
        reason: "reason",
        score: 86,
      },
      route: "stop",
      draft,
      errors: [],
      auditEvents: [],
    });

    expect(update.draft).toEqual(draft);
  });
});
