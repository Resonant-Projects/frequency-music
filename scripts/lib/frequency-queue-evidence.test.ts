import { describe, expect, test } from "vite-plus/test";
import { AGENT_RUN_STATUSES } from "../../convex/shared/statuses";
import {
  collectQueueEvidence,
  MAX_QUEUE_EVIDENCE_PAGES,
  validateOpsOrigin,
} from "./frequency-queue-evidence";

function page(overrides: Record<string, unknown> = {}) {
  return {
    counts: Object.fromEntries(
      AGENT_RUN_STATUSES.map((s) => [s, s === "queued" ? 1 : 0]),
    ),
    rowsRead: 1,
    cursor: null,
    isDone: true,
    claimsPaused: true,
    pageStatus: null,
    ...overrides,
  };
}

function fixture(pages: ReturnType<typeof page>[]) {
  const requests: Array<{ url: string; body: any; init?: RequestInit }> = [];
  let index = 0;
  const transport: typeof fetch = async (input, init) => {
    if (
      typeof input !== "string" ||
      (init?.body !== undefined && typeof init.body !== "string")
    )
      throw new Error("Unexpected request encoding");
    const url = input;
    requests.push({ url, body: JSON.parse(init?.body ?? "{}"), init });
    if (url.endsWith("/api/query_ts"))
      return Response.json({ ts: "synthetic-snapshot" });
    return Response.json({ status: "success", value: pages[index++] });
  };
  return { transport, requests };
}

describe("operator queue snapshot", () => {
  test("uses one timestamp and admin-only query across all pages; emits scalar totals only", async () => {
    const { transport, requests } = fixture([
      page({ isDone: false, cursor: "opaque-private-cursor" }),
      page(),
    ]);
    const result = await collectQueueEvidence(
      "https://backend.example",
      "inert-test-key",
      100,
      transport,
    );
    expect(result).toMatchObject({
      complete: true,
      rowsRead: 2,
      pages: 2,
      counts: { queued: 2 },
    });
    expect(JSON.stringify(result)).not.toContain("opaque-private-cursor");
    expect(JSON.stringify(result)).not.toContain("inert-test-key");
    expect(requests.map((r) => new URL(r.url).pathname)).toEqual([
      "/api/query_ts",
      "/api/query_at_ts",
      "/api/query_at_ts",
    ]);
    for (const request of requests.slice(1)) {
      expect(request.body.ts).toBe("synthetic-snapshot");
      expect(request.body.path).toBe("agentRuns:opsStatusCountsPage");
      expect(new Headers(request.init?.headers).get("Authorization")).toBe(
        "Convex inert-test-key",
      );
      expect(request.init?.redirect).toBe("error");
      expect(request.init?.signal).toBe(requests[0]?.init?.signal);
    }
  });

  test.each([
    { pageStatus: "SplitRequired" },
    { rowsRead: 2 },
    { counts: { queued: -1 } },
    { cursor: "unexpected" },
    { isDone: false, cursor: null },
  ])("fails closed for incomplete or malformed page %j", async (override) => {
    const { transport } = fixture([page(override)]);
    await expect(
      collectQueueEvidence("https://backend.example", "inert", 100, transport),
    ).rejects.toThrow();
  });

  test("rejects repeated cursors and a changed pause observation", async () => {
    for (const second of [
      page({ isDone: false, cursor: "repeat" }),
      page({ claimsPaused: false }),
    ]) {
      const { transport } = fixture([
        page({ isDone: false, cursor: "repeat" }),
        second,
      ]);
      await expect(
        collectQueueEvidence(
          "https://backend.example",
          "inert",
          100,
          transport,
        ),
      ).rejects.toThrow();
    }
  });

  test("caps total scan work without returning partial totals", async () => {
    const { transport } = fixture(
      Array.from({ length: MAX_QUEUE_EVIDENCE_PAGES }, (_, i) =>
        page({ isDone: false, cursor: String(i) }),
      ),
    );
    await expect(
      collectQueueEvidence("https://backend.example", "inert", 100, transport),
    ).rejects.toThrow("page limit");
  });

  test("authentication denial or snapshot expiry fails without retry", async () => {
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      if (calls === 1) return Response.json({ ts: "synthetic" });
      return new Response("denied or expired", { status: 400 });
    };
    await expect(
      collectQueueEvidence("https://backend.example", "inert", 100, transport),
    ).rejects.toThrow();
    expect(calls).toBe(2);
  });

  test.each([
    "http://backend.example",
    "https://user:secret@backend.example",
    "https://backend.example/path",
    "https://backend.example/?key=secret",
  ])("rejects unsafe target %s", (url) => {
    expect(() => validateOpsOrigin(url)).toThrow();
  });

  test("rejects missing credentials and invalid page size before networking", async () => {
    const { transport, requests } = fixture([]);
    for (const [key, size] of [
      ["", 100],
      ["inert", 201],
      ["inert", 0],
      ["inert", 1.5],
    ] as const) {
      await expect(
        collectQueueEvidence("https://backend.example", key, size, transport),
      ).rejects.toThrow();
    }
    expect(requests).toHaveLength(0);
  });
});
