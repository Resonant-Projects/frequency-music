import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vite-plus/test";
import {
  compareDeployedModules,
  manifestFromPushRequest,
  readDeployedModuleHashes,
} from "./convex-provenance";

const request = {
  adminKey: "frequency-offline-inert",
  dryRun: true,
  appDefinition: {
    udfServerVersion: "1.34.1",
    unchangedModuleHashes: [],
    changedModules: [
      { path: "z.js", environment: "node", source: "z", sourceMap: "map" },
      { path: "a.js", environment: "isolate", source: "a" },
    ],
  },
};

describe("Convex artifact evidence", () => {
  test("hashes exact source and map, sorts paths, excludes credentials and source", () => {
    const manifest = manifestFromPushRequest(request);
    expect(manifest.modules.map((module) => module.path)).toEqual([
      "a.js",
      "z.js",
    ]);
    expect(manifest.modules[1]?.hash).toBe(
      createHash("sha256").update("zmap").digest("hex"),
    );
    expect(JSON.stringify(manifest)).not.toContain("frequency-offline-inert");
    expect(JSON.stringify(manifest)).not.toContain("sourceMap");
    expect(manifest).not.toHaveProperty("sourceSha");
  });

  test("requires complete pinned inert dry-run bundles", () => {
    for (const change of [
      { adminKey: "unexpected" },
      { dryRun: false },
      { appDefinition: { ...request.appDefinition, udfServerVersion: "next" } },
      {
        appDefinition: {
          ...request.appDefinition,
          unchangedModuleHashes: [{}],
        },
      },
      { appDefinition: { ...request.appDefinition, changedModules: [] } },
    ]) {
      expect(() =>
        manifestFromPushRequest({ ...request, ...change }),
      ).toThrow();
    }
  });

  test("matches all modules order independently and rejects missing, extra, changed and duplicate modules", () => {
    const manifest = manifestFromPushRequest(request);
    expect(
      compareDeployedModules(manifest, {
        moduleHashes: [...manifest.modules].reverse(),
      }),
    ).toEqual({ rootModuleArtifactMatches: true, moduleCount: 2 });
    const first = manifest.modules[0]!;
    for (const moduleHashes of [
      manifest.modules.slice(1),
      [...manifest.modules, { ...first, path: "extra.js" }],
      [{ ...first, hash: "0".repeat(64) }, manifest.modules[1]],
      [{ ...first, environment: "node" }, manifest.modules[1]],
      [...manifest.modules, first],
      Array.from({ length: 10_001 }, () => first),
    ]) {
      expect(() =>
        compareDeployedModules(manifest, { moduleHashes }),
      ).toThrow();
    }
  });

  test("reads only existing privileged config API and strips unrelated fields", async () => {
    const manifest = manifestFromPushRequest(request);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ moduleHashes: manifest.modules, config: "private" }),
        ),
      );
    expect(
      await readDeployedModuleHashes(
        "https://convex.example",
        "inert",
        fetcher,
      ),
    ).toEqual({ moduleHashes: manifest.modules });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBeInstanceOf(URL);
    if (!(url instanceof URL)) throw new Error("Expected URL request");
    expect(url.href).toBe("https://convex.example/api/get_config_hashes");
    expect(options).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: { Authorization: "Convex inert" },
      body: JSON.stringify({ version: "1.34.1", adminKey: "inert" }),
    });
  });

  test("rejects missing auth and unsafe origins before request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const [url, key] of [
      ["http://convex.example", "inert"],
      ["https://user:pass@convex.example", "inert"],
      ["https://convex.example/path", "inert"],
      ["https://convex.example", ""],
    ]) {
      await expect(
        readDeployedModuleHashes(url!, key!, fetcher),
      ).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("fails closed on auth errors and oversize responses without echoing body", async () => {
    const denied = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private", { status: 401 }));
    await expect(
      readDeployedModuleHashes("https://convex.example", "inert", denied),
    ).rejects.toThrow("HTTP 401");
    const oversized = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("x".repeat(4 * 1024 * 1024 + 1)));
    await expect(
      readDeployedModuleHashes("https://convex.example", "inert", oversized),
    ).rejects.toThrow("4 MiB");
    const invalid = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private-not-json"));
    await expect(
      readDeployedModuleHashes("https://convex.example", "inert", invalid),
    ).rejects.toThrow(
      "Deployment artifact response has invalid module identities",
    );
  });
});
