import { describe, expect, test } from "vite-plus/test";

import {
  planAutomationSteps,
  shouldRunProxmoxSmoke,
  shouldRunResearchPipelineSmoke,
} from "../scripts/build-and-smoke";

describe("local automation planning", () => {
  test("skips optional infrastructure smokes by default", () => {
    expect(shouldRunProxmoxSmoke({})).toBe(false);
    expect(shouldRunResearchPipelineSmoke({})).toBe(false);

    const steps = planAutomationSteps({});

    expect(steps.map((step) => step.name)).toEqual([
      "TypeScript typecheck",
      "LangGraph Docker build",
    ]);
  });

  test("enables Proxmox smoke for explicit true-like flags", () => {
    for (const value of ["true", "TRUE", "1", "yes", " Yes "]) {
      expect(shouldRunProxmoxSmoke({ RUN_PROXMOX_SMOKE: value })).toBe(true);
    }

    const steps = planAutomationSteps({ RUN_PROXMOX_SMOKE: "true" });

    expect(steps.at(-1)).toMatchObject({
      name: "Optional Proxmox connectivity smoke",
      command: "bun",
      args: ["scripts/spike-proxmox.ts"],
      required: true,
    });
  });

  test("enables research pipeline smoke for explicit true-like flags", () => {
    for (const value of ["true", "TRUE", "1", "yes", " Yes "]) {
      expect(
        shouldRunResearchPipelineSmoke({ RUN_RESEARCH_PIPELINE_SMOKE: value }),
      ).toBe(true);
    }

    const steps = planAutomationSteps({ RUN_RESEARCH_PIPELINE_SMOKE: "true" });

    expect(steps.at(-1)).toMatchObject({
      name: "Optional research-pipeline Convex audit smoke",
      command: "bun",
      args: ["scripts/smoke-research-pipeline.ts"],
      required: true,
    });
  });
});
