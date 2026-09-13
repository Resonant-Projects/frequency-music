import { createHash } from "node:crypto";
import { z } from "zod";
import { manifestFromPushRequest } from "./convex-provenance";

const name = z.string().min(1).max(1024);
const bundle = z.object({
  path: name,
  environment: z.enum(["isolate", "node"]),
  source: z.string(),
  sourceMap: z.string().optional(),
});
const dependencies = z.array(name).max(100);
const component = z.object({
  definitionPath: name,
  definition: bundle,
  schema: bundle.nullable(),
  functions: z.array(bundle).max(10_000),
  dependencies,
  udfServerVersion: z.literal("1.34.1"),
});

function unique<T>(items: T[], key: (item: T) => string) {
  if (new Set(items.map(key)).size !== items.length)
    throw new Error("Duplicate candidate inventory identity");
  return [...items].sort((a, b) =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0,
  );
}
function identity(module: z.infer<typeof bundle>) {
  return {
    path: module.path,
    environment: module.environment,
    hash: createHash("sha256")
      .update(module.source)
      .update(module.sourceMap ?? "")
      .digest("hex"),
  };
}

/** Offline bundles only; does not execute source or pretend to analyze functions. */
export function candidateInventory(input: unknown) {
  const root = manifestFromPushRequest(input);
  const request = z
    .object({
      appDefinition: z.object({
        dependencies,
        schema: bundle.nullable(),
        definition: bundle.nullable(),
      }),
      componentDefinitions: z.array(component).max(100),
      nodeDependencies: z.array(z.object({ name, version: name })).max(1000),
    })
    .parse(input);
  const definitions = unique(
    request.componentDefinitions,
    (c) => c.definitionPath,
  );
  const paths = new Set(definitions.map((c) => c.definitionPath));
  for (const deps of [
    request.appDefinition.dependencies,
    ...definitions.map((c) => c.dependencies),
  ]) {
    unique(deps, (path) => path);
    if (deps.some((path) => !paths.has(path)))
      throw new Error("Unknown component dependency");
  }
  const components = definitions.map((c) => {
    const modules = unique(
      [...c.functions, c.definition, ...(c.schema ? [c.schema] : [])].map(
        identity,
      ),
      (m) => m.path,
    );
    if (modules.length > 10_000) throw new Error("Component inventory limit");
    return {
      definitionPath: c.definitionPath,
      dependencies: unique(c.dependencies, (path) => path),
      udfServerVersion: c.udfServerVersion,
      modules,
      schema: c.schema ? identity(c.schema) : null,
      definition: identity(c.definition),
    };
  });
  if (
    root.modules.length + components.reduce((n, c) => n + c.modules.length, 0) >
    20_000
  )
    throw new Error("Total candidate inventory limit");
  return {
    format: "frequency-convex-candidate-bundles-v1",
    scope:
      "offline-bundle-identities; not runtime analysis, deployment provenance or recovery artifact",
    deploymentAuthorized: false,
    root: {
      ...root,
      dependencies: unique(request.appDefinition.dependencies, (path) => path),
      schema: request.appDefinition.schema
        ? identity(request.appDefinition.schema)
        : null,
      definition: request.appDefinition.definition
        ? identity(request.appDefinition.definition)
        : null,
    },
    components,
    nodeDependencies: unique(request.nodeDependencies, (dep) => dep.name),
  };
}
