import { describe, expect, test } from "bun:test";

import { planAutomationSteps, shouldRunProxmoxSmoke } from "../scripts/build-and-smoke";

describe("local automation planning", () => {
  test("skips Proxmox smoke by default", () => {
    expect(shouldRunProxmoxSmoke({})).toBe(false);

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
});
