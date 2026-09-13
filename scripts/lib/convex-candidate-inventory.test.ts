import { createHash } from "node:crypto";
import { expect, test } from "vite-plus/test";
import { candidateInventory } from "./convex-candidate-inventory";

const module = (path: string) => ({
  path,
  environment: "isolate",
  source: "private source",
  sourceMap: "private map",
});
const request = () => ({
  adminKey: "frequency-offline-inert",
  dryRun: true,
  appDefinition: {
    udfServerVersion: "1.34.1",
    unchangedModuleHashes: [],
    changedModules: [module("run.js")],
    schema: module("schema.js"),
    definition: module("convex.config.js"),
    dependencies: ["child"],
  },
  componentDefinitions: [
    {
      definitionPath: "child",
      udfServerVersion: "1.34.1",
      functions: [module("job.js")],
      schema: module("schema.js"),
      definition: module("convex.config.js"),
      dependencies: [] as string[],
    },
  ],
  nodeDependencies: [] as { name: string; version: string }[],
});

test("inventories root and complete component bundles without exposing executable bytes", () => {
  const result = candidateInventory(request());
  expect(result.root.modules).toHaveLength(3);
  expect(result.components[0]!.modules).toHaveLength(3);
  expect(result.components[0]!.schema!.hash).toBe(
    createHash("sha256").update("private sourceprivate map").digest("hex"),
  );
  expect(result.deploymentAuthorized).toBe(false);
  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain("private source");
  expect(serialized).not.toContain("private map");
  expect(serialized).not.toContain("frequency-offline-inert");
});

test("rejects partial dependencies and duplicate bundle identities", () => {
  const missing = request();
  missing.appDefinition.dependencies = ["missing"];
  expect(() => candidateInventory(missing)).toThrow("Unknown component");
  const duplicate = request();
  duplicate.componentDefinitions[0]!.functions.push(module("schema.js"));
  expect(() => candidateInventory(duplicate)).toThrow("Duplicate");
  const paths = request();
  paths.componentDefinitions.push(paths.componentDefinitions[0]!);
  expect(() => candidateInventory(paths)).toThrow("Duplicate");
  const deps = request();
  deps.nodeDependencies = [
    { name: "x", version: "1" },
    { name: "x", version: "2" },
  ];
  expect(() => candidateInventory(deps)).toThrow("Duplicate");
});

test("rejects incomplete or incompatible requests and bounded count overflow", () => {
  expect(() =>
    candidateInventory({ ...request(), componentDefinitions: undefined }),
  ).toThrow();
  const version = request();
  version.componentDefinitions[0]!.udfServerVersion = "unknown";
  expect(() => candidateInventory(version)).toThrow();
  const overflow = request();
  overflow.componentDefinitions = Array.from({ length: 101 }, (_, i) => ({
    ...overflow.componentDefinitions[0]!,
    definitionPath: String(i),
  }));
  expect(() => candidateInventory(overflow)).toThrow();
});
