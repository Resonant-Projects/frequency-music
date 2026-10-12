import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { api } from "../convex/_generated/api";

const client = vi.hoisted(() => ({ query: vi.fn(), action: vi.fn() }));
vi.mock("varlock/auto-load", () => ({}));
vi.mock("./lib/convexClient", () => ({
  getConvexClient: () => client,
  getDevBypassSecret: () => "inert-test-secret",
}));

const savedArgv = process.argv;

describe("unreviewed concept retry CLI", () => {
  beforeEach(() => {
    vi.resetModules();
    client.query.mockReset();
    client.action.mockReset();
    client.action.mockResolvedValue({
      classifications: [],
      assigned: 0,
      unreviewed: 0,
      skipped: 0,
      failed: 0,
      inputTokens: 0,
      outputTokens: 0,
      llmCalls: 1,
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });
  afterEach(() => {
    process.argv = savedArgv;
    vi.restoreAllMocks();
  });

  test("preview selects only unreviewed concepts, forces retries, and respects the cap", async () => {
    process.argv = [
      "node",
      "classify-concepts.ts",
      "--retry-unreviewed",
      "--limit=2",
    ];
    client.query.mockResolvedValue({
      conceptIds: ["one", "two", "three"],
      continueCursor: "next",
      isDone: false,
    });
    await import("./classify-concepts");
    expect(client.query).toHaveBeenCalledExactlyOnceWith(
      api.conceptClassifier.listClassificationCandidates,
      expect.objectContaining({ force: true, unreviewedOnly: true }),
    );
    expect(client.action).toHaveBeenCalledExactlyOnceWith(
      api.conceptClassifier.classifyConcepts,
      expect.objectContaining({
        conceptIds: ["one", "two"],
        force: true,
        apply: false,
      }),
    );
  });

  test("applying a retry defaults to 30 concepts across cursor pages", async () => {
    process.argv = [
      "node",
      "classify-concepts.ts",
      "--retry-unreviewed",
      "--apply",
      "--batch-size=20",
    ];
    const firstIds = Array.from({ length: 20 }, (_, index) => `first-${index}`);
    const secondIds = Array.from(
      { length: 20 },
      (_, index) => `second-${index}`,
    );
    client.query
      .mockResolvedValueOnce({
        conceptIds: firstIds,
        continueCursor: "next",
        isDone: false,
      })
      .mockResolvedValueOnce({
        conceptIds: secondIds,
        continueCursor: "last",
        isDone: false,
      });
    await import("./classify-concepts");
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenLastCalledWith(
      api.conceptClassifier.listClassificationCandidates,
      expect.objectContaining({
        cursor: "next",
        force: true,
        unreviewedOnly: true,
      }),
    );
    expect(client.action).toHaveBeenCalledTimes(2);
    expect(client.action).toHaveBeenNthCalledWith(
      1,
      api.conceptClassifier.classifyConcepts,
      expect.objectContaining({
        conceptIds: firstIds,
        force: true,
        apply: true,
      }),
    );
    expect(client.action).toHaveBeenNthCalledWith(
      2,
      api.conceptClassifier.classifyConcepts,
      expect.objectContaining({
        conceptIds: secondIds.slice(0, 10),
        force: true,
        apply: true,
      }),
    );
  });
});
