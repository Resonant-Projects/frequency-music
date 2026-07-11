import { describe, expect, test } from "vite-plus/test";
import { buildEditCaptureRow } from "./editCaptures";

describe("editCaptures", () => {
  test("builds an unexported row and omits absent metadata", () => {
    expect(
      buildEditCaptureRow({
        entityType: "hypothesis",
        entityId: "h1",
        generated: { title: "a" },
        edited: { title: "b" },
        now: 5,
      }),
    ).toEqual({
      entityType: "hypothesis",
      entityId: "h1",
      generated: { title: "a" },
      edited: { title: "b" },
      editedAt: 5,
      exported: false,
    });
  });

  test("includes promptVersion/model when provided", () => {
    const row = buildEditCaptureRow({
      entityType: "weeklyBrief",
      entityId: "b1",
      generated: {},
      edited: {},
      promptVersion: "brief_v2",
      model: "claude-sonnet-4-6",
      now: 9,
    });
    expect(row.promptVersion).toBe("brief_v2");
    expect(row.model).toBe("claude-sonnet-4-6");
    expect(row.exported).toBe(false);
  });
});
