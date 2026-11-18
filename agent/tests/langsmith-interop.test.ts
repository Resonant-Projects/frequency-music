import { createRequire } from "node:module";
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";
import { Client } from "langsmith";
import { RunTree } from "langsmith/run_trees";
import { getCurrentRunTree, withRunTree } from "langsmith/traceable";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { resolveCurrentTraceUrl } from "../src/tracing/currentTrace.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("Core and DeepAgents use one LangSmith SDK and retain trace provenance", async () => {
  const require = createRequire(import.meta.url);
  const core = createRequire(require.resolve("@langchain/core/package.json"));
  const deepagents = createRequire(require.resolve("deepagents"));
  const sdk = require.resolve("langsmith/package.json");
  expect(core.resolve("langsmith/package.json")).toBe(sdk);
  expect(deepagents.resolve("langsmith/package.json")).toBe(sdk);
  const fetchUrl = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ url: "https://example.test/trace" }),
  );
  const client = new Client({
    apiKey: "synthetic",
    apiUrl: "http://127.0.0.1:9",
    fetchImplementation: fetchUrl,
  });
  const project = vi.spyOn(client, "readProject").mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000001",
  } as Awaited<ReturnType<Client["readProject"]>>);
  const root = new RunTree({
    name: "SDK interop",
    project_name: "custom-project",
    client,
  });
  const run = root.createChild({ name: "Nested run" });
  vi.stubEnv("LANGSMITH_TRACING", "true");
  await withRunTree(run, async () => {
    expect(getCurrentRunTree()).toBe(run);
    expect(LangChainTracer.getTraceableRunTree()).toBe(run);
    expect(await resolveCurrentTraceUrl(undefined)).toBe(
      "https://example.test/trace",
    );
  });
  expect(project).toHaveBeenCalledWith({ projectName: "custom-project" });
  const requests = fetchUrl.mock.calls.map(([url]) => new URL(String(url)));
  expect(requests.map((url) => url.pathname)).toEqual([
    "/info",
    `/api/v2/runs/${root.trace_id}/url`,
  ]);
  const request = requests[1];
  expect(request.pathname).toBe(`/api/v2/runs/${root.trace_id}/url`);
  expect(request.searchParams.get("project_id")).toBe(
    "00000000-0000-4000-8000-000000000001",
  );
  expect(request.searchParams.get("trace_id")).toBe(root.trace_id);
  expect(request.searchParams.has("start_time")).toBe(false);
});

test("explicit URL, disabled tracing, and absent context skip lookup", async () => {
  expect(await resolveCurrentTraceUrl("https://example.test/provided")).toBe(
    "https://example.test/provided",
  );
  vi.stubEnv("LANGSMITH_TRACING", "false");
  expect(await resolveCurrentTraceUrl(undefined)).toBeUndefined();
  vi.stubEnv("LANGSMITH_TRACING", "true");
  expect(await resolveCurrentTraceUrl(undefined)).toBeUndefined();
});

test("project lookup failure preserves best-effort trace provenance", async () => {
  const client = new Client({
    apiKey: "synthetic",
    apiUrl: "http://127.0.0.1:9",
  });
  vi.spyOn(client, "readProject").mockRejectedValue(new Error("unavailable"));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("LANGSMITH_TRACING", "true");
  await withRunTree(
    new RunTree({ name: "failed lookup", client }),
    async () => {
      expect(await resolveCurrentTraceUrl(undefined)).toBeUndefined();
    },
  );
  expect(warning).toHaveBeenCalledOnce();
});

test("URL lookup failure remains non-fatal", async () => {
  const client = new Client({
    apiKey: "synthetic",
    apiUrl: "http://127.0.0.1:9",
  });
  vi.spyOn(client, "readProject").mockResolvedValue({
    id: "project",
  } as Awaited<ReturnType<Client["readProject"]>>);
  vi.spyOn(client.runs, "getURL").mockRejectedValue(new Error("unavailable"));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("LANGSMITH_TRACING", "true");
  await withRunTree(new RunTree({ name: "failed URL", client }), async () => {
    expect(await resolveCurrentTraceUrl(undefined)).toBeUndefined();
  });
  expect(warning).toHaveBeenCalledOnce();
});
