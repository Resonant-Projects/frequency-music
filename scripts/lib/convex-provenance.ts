import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { validateOpsOrigin } from "./frequency-queue-evidence";

const moduleIdentity = z.object({
  path: z.string().min(1).max(1024),
  environment: z.enum(["isolate", "node"]),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});
const bundledModule = z.object({
  path: moduleIdentity.shape.path,
  environment: moduleIdentity.shape.environment,
  source: z.string(),
  sourceMap: z.string().optional(),
});
const identities = z.array(moduleIdentity).min(1).max(10_000);
const manifestSchema = z.object({
  format: z.literal("frequency-convex-root-modules-v1"),
  convexVersion: z.literal("1.34.1"),
  scope: z.literal("root-modules-only"),
  modules: identities,
});
export type ConvexProvenanceManifest = z.infer<typeof manifestSchema>;

/** Verify the captured bytes, independent of further changes to the input path. */
export function verifyManifestSnapshot(
  bytes: Buffer,
  verify: (path: string) => void,
) {
  const directory = mkdtempSync(join(tmpdir(), "frequency-manifest-verify-"));
  try {
    const path = join(directory, "manifest.json");
    writeFileSync(path, bytes, { mode: 0o400, flag: "wx" });
    verify(path);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function sortedUnique(modules: z.infer<typeof identities>) {
  if (new Set(modules.map((module) => module.path)).size !== modules.length) {
    throw new Error("Duplicate module paths in provenance evidence");
  }
  return [...modules].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}

/** Convex 1.34.1 hashes source followed by sourceMap. The deployed root set
 * includes separately bundled schema/definition as well as changedModules. */
export function manifestFromPushRequest(
  input: unknown,
): ConvexProvenanceManifest {
  const request = z
    .object({
      adminKey: z.literal("frequency-offline-inert"),
      dryRun: z.literal(true),
      appDefinition: z.object({
        udfServerVersion: z.literal("1.34.1"),
        unchangedModuleHashes: z.array(z.unknown()).length(0),
        // Pinned 1.34.1 AppDefinitionConfig requires both keys, allowing null.
        definition: bundledModule.nullable(),
        schema: bundledModule.nullable(),
        changedModules: z.array(bundledModule).min(1).max(10_000),
      }),
    })
    .parse(input);
  return {
    format: "frequency-convex-root-modules-v1",
    convexVersion: "1.34.1",
    scope: "root-modules-only",
    modules: sortedUnique(
      identities.parse(
        [
          ...request.appDefinition.changedModules,
          ...(request.appDefinition.schema
            ? [request.appDefinition.schema]
            : []),
          ...(request.appDefinition.definition
            ? [request.appDefinition.definition]
            : []),
        ].map((module) => ({
          path: module.path,
          environment: module.environment,
          hash: createHash("sha256")
            .update(module.source)
            .update(module.sourceMap ?? "")
            .digest("hex"),
        })),
      ),
    ),
  };
}

/** This comparison proves artifact equality only. Verify the manifest's GitHub
 * attestation independently before associating the result with a source SHA. */
export function compareDeployedModules(
  trustedManifest: unknown,
  backendResponse: unknown,
) {
  const manifest = manifestSchema.parse(trustedManifest);
  const deployed = z
    .object({ moduleHashes: identities })
    .parse(backendResponse);
  const expected = sortedUnique(manifest.modules);
  const actual = sortedUnique(deployed.moduleHashes);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(
      "Deployed root module artifact does not match release manifest",
    );
  }
  return { rootModuleArtifactMatches: true, moduleCount: expected.length };
}

/** Offline review aid only: a delta never establishes provenance or authorizes deployment. */
export function deployedModuleDelta(
  releaseManifest: unknown,
  backendResponse: unknown,
) {
  const expected = sortedUnique(manifestSchema.parse(releaseManifest).modules);
  const actual = sortedUnique(
    z.object({ moduleHashes: identities }).parse(backendResponse).moduleHashes,
  );
  const before = new Map(actual.map((module) => [module.path, module]));
  const after = new Map(expected.map((module) => [module.path, module]));
  const added = expected.filter((module) => !before.has(module.path));
  const removed = actual.filter((module) => !after.has(module.path));
  const changed = expected.flatMap((module) => {
    const deployed = before.get(module.path);
    return deployed &&
      (deployed.hash !== module.hash ||
        deployed.environment !== module.environment)
      ? [{ path: module.path, before: deployed, after: module }]
      : [];
  });
  return {
    scope: "root-module-identities-only",
    deploymentAuthorized: false,
    deployedCount: actual.length,
    releaseCount: expected.length,
    unchangedCount: expected.length - added.length - changed.length,
    added,
    removed,
    changed,
  };
}

/** Existing privileged CLI API; POST is a read here (cli/lib/config.ts).
 * Never log the response, headers, or key: config can contain provider details. */
export async function readDeployedModuleHashes(
  origin: string,
  adminKey: string,
  fetcher: typeof fetch = fetch,
) {
  const url = new URL(validateOpsOrigin(origin));
  if (!adminKey) {
    throw new Error(
      "An HTTPS deployment origin and existing admin key are required",
    );
  }
  const response = await fetcher(new URL("/api/get_config_hashes", url), {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Convex ${adminKey}`,
      "Content-Type": "application/json",
      "Convex-Client": "npm-cli-1.34.1",
    },
    body: JSON.stringify({ version: "1.34.1", adminKey }),
  });
  if (!response.ok || !response.body) {
    throw new Error(
      `Deployment artifact read failed (HTTP ${response.status})`,
    );
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4 * 1024 * 1024) {
        throw new Error("Deployment artifact response exceeds 4 MiB limit");
      }
      chunks.push(value);
    }
    try {
      const parsed = z
        .object({ moduleHashes: identities })
        .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      return { moduleHashes: sortedUnique(parsed.moduleHashes) };
    } catch {
      throw new Error(
        "Deployment artifact response has invalid module identities",
      );
    }
  } finally {
    await reader.cancel();
  }
}
