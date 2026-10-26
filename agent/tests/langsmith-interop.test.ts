import { createRequire } from "node:module";
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";
import { Client } from "langsmith";
import { RunTree } from "langsmith/run_trees";
import { getCurrentRunTree, withRunTree } from "langsmith/traceable";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { resolveCurrentTraceUrl } from "../src/tracing/currentTrace.js";

afterEach(() => vi.unstubAllEnvs());

test("Core and DeepAgents use one LangSmith SDK and retain trace provenance", async () => {
  const require = createRequire(import.meta.url);
  const core = createRequire(require.resolve("@langchain/core/package.json"));
  const deepagents = createRequire(require.resolve("deepagents"));
  const sdk = require.resolve("langsmith/package.json");
  expect(core.resolve("langsmith/package.json")).toBe(sdk);
  expect(deepagents.resolve("langsmith/package.json")).toBe(sdk);
  const client = new Client({
    apiKey: "synthetic",
    apiUrl: "http://127.0.0.1:9",
  });
  const getUrl = vi
    .spyOn(client, "getRunUrl")
    .mockResolvedValue("https://example.test/trace");
  const run = new RunTree({ name: "SDK interop", client });
  vi.stubEnv("LANGSMITH_TRACING", "true");
  await withRunTree(run, async () => {
    expect(getCurrentRunTree()).toBe(run);
    expect(LangChainTracer.getTraceableRunTree()).toBe(run);
    expect(await resolveCurrentTraceUrl(undefined)).toBe(
      "https://example.test/trace",
    );
  });
  expect(getUrl).toHaveBeenCalledTimes(1);
});
