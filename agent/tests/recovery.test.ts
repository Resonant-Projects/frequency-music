import { callConvex, ConvexToolHttpError } from "../src/tools/convexTools.js";
import { mkdtemp, rm, readdir, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import { DurableOutbox } from "../src/shared/outbox.js";
import { captureSourceAttempt } from "../src/graphs/source-scout/captureAttempt.js";
import { createInvestigateNode } from "../src/graphs/failure-investigation/index.js";
import { recoverCaptureNode } from "../src/graphs/source-scout/nodes.js";
import type { SourceScoutState } from "../src/state/sourceScoutState.js";
import { captureInputZ } from "../../convex/shared/operationRecovery";

describe("recovery seams", () => {
  test("a concurrent removal during dead-letter handling does not strand later deliveries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "recovery-race-"));
    try {
      for (let i = 0; i < 2; i++)
        await writeFile(
          join(dir, `0000000${i}.json`),
          JSON.stringify({
            tool: "appendAgentRunEvent",
            args: { ordinal: i },
          }),
        );
      const delivered: number[] = [];
      const rejected = new ConvexToolHttpError("rejected", 400);
      await expect(
        new DurableOutbox(dir).flush(async (_name, args) => {
          if (args.ordinal === 0) {
            await unlink(join(dir, "00000000.json"));
            throw rejected;
          }
          delivered.push(args.ordinal as number);
          return null;
        }),
      ).rejects.toBe(rejected);
      expect(delivered).toEqual([1]);
      expect(
        (await readdir(dir)).filter((name) => name.endsWith(".json")),
      ).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  test.each([false, true])(
    "an emoji at the capture limit remains valid for intake and retained failure (intake fails: %s)",
    async (failIntake) => {
      const calls = new Map<string, Record<string, unknown>>();
      const callTool = vi.fn(async (name: string, args: unknown) => {
        calls.set(name, args as Record<string, unknown>);
        if (name === "ingestScoutedSource") {
          if (failIntake) throw new Error("intake offline");
          return { id: "source", created: true };
        }
        return null;
      });
      const result = await captureSourceAttempt(
        {
          agentRunId: "run",
          input: { url: "https://example.org", query: "q", rationale: "r" },
          page: { text: "x".repeat(29_999) + "🎵", provider: "firecrawl" },
        },
        callTool,
      );
      const text = calls.get("ingestScoutedSource")!.rawText as string;
      expect(text.isWellFormed()).toBe(true);
      expect(Buffer.from(text).toString("utf8")).toBe(text);
      expect(text).toHaveLength(29_999);
      expect(result.failed).toBe(failIntake);
      if (failIntake) {
        const retained = captureInputZ.parse(
          calls.get("reportCaptureFailure")!.input,
        );
        expect(retained.rawText).toBe(text);
      } else expect(calls.has("reportCaptureFailure")).toBe(false);
    },
  );
  test("capture and retained recovery inputs use the same text bound", async () => {
    const callTool = vi.fn(async (name: string, _args: unknown) =>
      name === "ingestScoutedSource" ? { id: "source" } : null,
    );
    await captureSourceAttempt(
      {
        agentRunId: "run",
        input: { url: "https://example.org", query: "q", rationale: "r" },
        page: { text: "x".repeat(40_000), provider: "firecrawl" },
      },
      callTool,
    );
    const input = callTool.mock.calls.find(
      ([name]) => name === "ingestScoutedSource",
    )![1];
    expect((input as { rawText: string }).rawText).toHaveLength(30_000);
  });
  test.each([400, 403, 429, 503])(
    "outbox quarantines terminal HTTP errors and retains transient status %s",
    async (status) => {
      const dir = await mkdtemp(join(tmpdir(), "recovery-outbox-"));
      try {
        const outbox = new DurableOutbox(dir);
        await outbox.enqueue({
          tool: "appendAgentRunEvent",
          args: { deliveryId: "stable" },
        });
        await expect(
          outbox.flush(async () => {
            throw new ConvexToolHttpError("rejected", status);
          }),
        ).rejects.toThrow("rejected");
        const files = await readdir(dir);
        if (status < 429) {
          expect(files).toEqual(["dead-letter"]);
          expect(await readdir(join(dir, "dead-letter"))).toHaveLength(1);
        } else
          expect(files.filter((file) => file.endsWith(".json"))).toHaveLength(
            1,
          );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
  test("capture recovery transport aborts stalled read and completion responses", async () => {
    vi.stubEnv("CONVEX_SITE_URL", "https://test.invalid");
    vi.stubEnv("AGENT_TOOL_SECRET", "test-only");
    try {
      for (const name of [
        "getCaptureRecovery",
        "finishCaptureRecovery",
        "markAgentRunFailed",
        "getAgentRun",
      ]) {
        const abort = new AbortController();
        const timeout = vi
          .spyOn(AbortSignal, "timeout")
          .mockReturnValue(abort.signal);
        vi.stubGlobal(
          "fetch",
          vi.fn(
            (_url: unknown, options: RequestInit) =>
              new Promise((_resolve, reject) =>
                options.signal!.addEventListener(
                  "abort",
                  () => reject(options.signal!.reason),
                  { once: true },
                ),
              ),
          ),
        );
        const request = callConvex(name, {});
        abort.abort(new Error("transport deadline"));
        await expect(request).rejects.toThrow("transport deadline");
        timeout.mockRestore();
      }
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    }
  });

  test("the investigation deadline aborts stalled evidence and submission calls", async () => {
    for (const stalled of [
      "getFailureInvestigation",
      "submitFailureDiagnosis",
    ]) {
      const abort = new AbortController();
      const timeout = vi
        .spyOn(AbortSignal, "timeout")
        .mockReturnValue(abort.signal);
      let entered!: () => void;
      const ready = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const callTool = vi.fn(
        async (name: string, _args: unknown, signal?: AbortSignal) => {
          if (name !== stalled) return [];
          entered();
          return new Promise((_resolve, reject) =>
            signal!.addEventListener("abort", () => reject(signal!.reason), {
              once: true,
            }),
          );
        },
      );
      try {
        const running = createInvestigateNode(callTool, {
          invoke: async () => ({ diagnosis: "Retry", recover: true }),
        })({ agentRunId: "run" });
        await ready;
        abort.abort(new Error("investigation deadline"));
        await expect(running).rejects.toThrow("investigation deadline");
      } finally {
        timeout.mockRestore();
      }
    }
  });

  test("a failed crawl still stores the URL and reports failure", async () => {
    const callTool = vi.fn(async (name: string) =>
      name === "ingestScoutedSource" ? { id: "source", created: true } : null,
    );
    const result = await captureSourceAttempt(
      {
        agentRunId: "run",
        input: { url: "https://example.org", query: "q", rationale: "r" },
      },
      callTool,
      async () => {
        throw new Error("network down");
      },
    );
    expect(result).toMatchObject({ id: "source", failed: true });
    expect(callTool).toHaveBeenCalledWith(
      "reportCaptureFailure",
      expect.objectContaining({ stage: "capture" }),
    );
  });
  test("retained text goes straight to intake without crawling", async () => {
    const crawl = vi.fn();
    const callTool = vi.fn(async () => ({ id: "source", enriched: true }));
    const result = await captureSourceAttempt(
      {
        agentRunId: "run",
        input: {
          url: "https://example.org",
          query: "q",
          rationale: "r",
          rawText: "retained",
          contentProvider: "firecrawl",
        },
      },
      callTool,
      crawl,
    );
    expect(result.failed).toBe(false);
    expect(crawl).not.toHaveBeenCalled();
  });
  test("failed intake retains publication date and recovery replays it", async () => {
    const publishedAt = Date.parse("2026-06-01");
    const reports: unknown[] = [];
    const callTool = vi.fn(async (name: string, args: unknown) => {
      if (name === "ingestScoutedSource") throw new Error("intake offline");
      if (name === "reportCaptureFailure") reports.push(args);
      return null;
    });
    const failed = await captureSourceAttempt(
      {
        agentRunId: "run",
        input: {
          url: "https://example.org",
          publishedAt,
          query: "q",
          rationale: "r",
        },
        page: { text: "captured", provider: "firecrawl" },
      },
      callTool,
    );
    expect(failed.failed).toBe(true);
    // The stored recovery target is the server-validated capture input.
    const retained = captureInputZ.parse(
      (reports[0] as { input: unknown }).input,
    );
    expect(retained).toMatchObject({ publishedAt, rawText: "captured" });

    vi.stubEnv("CONVEX_SITE_URL", "https://test.invalid");
    vi.stubEnv("AGENT_TOOL_SECRET", "test-only");
    const bodies = new Map<string, Record<string, unknown>>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options: RequestInit) => {
        const name = url.split("/").at(-1)!;
        bodies.set(name, JSON.parse(options.body as string));
        const result =
          name === "getCaptureRecovery"
            ? { failureId: "failure", input: retained }
            : name === "ingestScoutedSource"
              ? { id: "source", created: true }
              : null;
        return new Response(JSON.stringify(result));
      }),
    );
    try {
      const recovered = await recoverCaptureNode({
        agentRunId: "recovery",
      } as SourceScoutState);
      expect(recovered.captureFailureCount).toBe(0);
      expect(bodies.get("ingestScoutedSource")).toMatchObject({
        publishedAt,
        rawText: "captured",
        agentRunId: "recovery",
      });
      expect(bodies.get("finishCaptureRecovery")).toMatchObject({
        success: true,
      });
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
  test("outbox survives reconstruction and removes only acknowledged records", async () => {
    const dir = await mkdtemp(join(tmpdir(), "recovery-outbox-"));
    try {
      await new DurableOutbox(dir).enqueue({
        tool: "appendAgentRunEvent",
        args: { runId: "run", deliveryId: "stable" },
      });
      await expect(
        new DurableOutbox(dir).flush(async () => {
          throw new Error("offline");
        }),
      ).rejects.toThrow("offline");
      expect(await readdir(dir)).toHaveLength(1);
      const callTool = vi.fn(async () => null);
      await new DurableOutbox(dir).flush(callTool);
      expect(callTool).toHaveBeenCalledWith("appendAgentRunEvent", {
        runId: "run",
        deliveryId: "stable",
      });
      expect(await readdir(dir)).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  test("a failed outbox batch cannot starve later deliveries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "recovery-outbox-"));
    try {
      for (let index = 0; index < 6; index++) {
        await writeFile(
          join(dir, `${index}.json`),
          JSON.stringify({
            tool: "appendAgentRunEvent",
            args: { deliveryId: String(index) },
          }),
        );
      }
      const outbox = new DurableOutbox(dir);
      const callTool = vi.fn(async (_name, args) => {
        if (args.deliveryId !== "5") throw new Error("rejected");
        return null;
      });
      await expect(outbox.flush(callTool)).rejects.toThrow("rejected");
      expect(callTool).toHaveBeenCalledTimes(5);
      await expect(outbox.flush(callTool)).rejects.toThrow("rejected");
      expect(callTool).toHaveBeenCalledWith("appendAgentRunEvent", {
        deliveryId: "5",
      });
      expect(await readdir(dir)).not.toContain("5.json");
      expect(await readdir(dir)).toHaveLength(5);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  test("investigator returns a bounded diagnosis and leaves completion to the runner", async () => {
    const callTool = vi.fn(async () => [{ message: "untrusted", attempts: 2 }]);
    const judge = {
      invoke: vi.fn(async () => ({
        diagnosis: "Service recovered; retry intake",
        recover: true,
      })),
    };
    const result = await createInvestigateNode(
      callTool,
      judge,
    )({ agentRunId: "investigator" });
    expect(result.summary).toContain("Service recovered");
    expect(callTool.mock.calls.map(([name]) => name)).toEqual([
      "getFailureInvestigation",
      "submitFailureDiagnosis",
    ]);
  });
});
