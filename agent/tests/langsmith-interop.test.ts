import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Client } from "langsmith";
import { RunTree } from "langsmith/run_trees";
import { getCurrentRunTree, withRunTree } from "langsmith/traceable";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { resolveCurrentTraceUrl } from "../src/tracing/currentTrace.js";

afterEach(() => vi.unstubAllEnvs());

test("DeepAgents' compatible SDK and Core's newer SDK share trace provenance", async () => {
  const require = createRequire(import.meta.url);
  const core = createRequire(require.resolve("@langchain/core/package.json"));
  const newer = await import(
    pathToFileURL(core.resolve("langsmith/traceable")).href
  );
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
    expect(newer.getCurrentRunTree()).toBe(run);
    expect(await resolveCurrentTraceUrl(undefined)).toBe(
      "https://example.test/trace",
    );
  });
  await newer.withRunTree(run, async () => {
    expect(getCurrentRunTree()).toBe(run);
    expect(await resolveCurrentTraceUrl(undefined)).toBe(
      "https://example.test/trace",
    );
  });
  expect(getUrl).toHaveBeenCalledTimes(2);
});
