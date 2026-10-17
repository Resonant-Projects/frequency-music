import { z } from "zod";

/**
 * Offline reading of a saved `scripts/convex-deployment-inspect.ts` result.
 * Answers which Listen-first capabilities the deployed root component carries
 * and which functions the current web source calls that it lacks. Reads no
 * credential and contacts nothing; the inspection itself is the live read.
 */

export interface RequiredFunction {
  module: string;
  name: string;
}

export interface CoverageGroup {
  id: string;
  description: string;
  functions: RequiredFunction[];
  httpRoutes: string[];
  crons: string[];
}

const fn = (module: string, ...names: string[]): RequiredFunction[] =>
  names.map((name) => ({ module, name }));

/** Backend capabilities each merged PR adds, in deployment order. */
export const COVERAGE_GROUPS: readonly CoverageGroup[] = Object.freeze([
  {
    id: "wave2-138",
    description: "Wave 2 docket, signed decisions and revision backfill (#138)",
    functions: [
      ...fn("docket", "listWeb", "prepare"),
      ...fn("decisionIntents", "get", "applyWeb", "deferWeb", "cancelWeb"),
      ...fn("decisionIntentsMigrations", "backfillRevisions"),
    ],
    httpRoutes: ["POST /discord/interactions", "POST /telegram/webhook/"],
    crons: ["rebuild-docket"],
  },
  {
    id: "audio-feedback-141",
    description: "General audio ratings and signed deferral (#141)",
    functions: [
      ...fn("audioFeedback", "queue", "item", "submit"),
      ...fn("audioArtifacts", "listReadyForTarget"),
    ],
    httpRoutes: [],
    crons: [],
  },
  {
    id: "rendering-140",
    description: "Litmus render jobs (#140)",
    functions: fn("renders", "request", "setPlan", "validationGate"),
    httpRoutes: [],
    crons: [],
  },
  {
    id: "tournament-142",
    description: "Hypothesis tournament persistence (#142)",
    functions: fn(
      "hypothesisTournament",
      "beginRun",
      "recordCandidates",
      "completeRun",
      "submitDraft",
      "finalizeRun",
    ),
    httpRoutes: [],
    crons: [],
  },
]);

const API_REFERENCE = /\bapi\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\b/g;

/** Public functions referenced as `api.<module>.<name>` in source text. */
export function webApiReferences(
  sources: Iterable<string>,
): RequiredFunction[] {
  const seen = new Map<string, RequiredFunction>();
  for (const source of sources) {
    for (const match of source.matchAll(API_REFERENCE)) {
      const reference = { module: match[1]!, name: match[2]! };
      seen.set(`${reference.module}:${reference.name}`, reference);
    }
  }
  return [...seen.values()].toSorted((a, b) =>
    `${a.module}:${a.name}` < `${b.module}:${b.name}` ? -1 : 1,
  );
}

// Only the fields this report reads; the inspection format is
// `frequency-deployment-inspection-v1` from scripts/lib/convex-deployment-inspect.ts.
const inspectionZ = z.object({
  format: z.literal("frequency-deployment-inspection-v1"),
  finishedAt: z.string(),
  modules: z.array(
    z.object({
      componentId: z.string().nullable(),
      modules: z.array(
        z.object({
          path: z.string(),
          functions: z.array(z.object({ name: z.string() })),
          crons: z.array(z.object({ identifier: z.string() })),
        }),
      ),
    }),
  ),
});

function modulePath(module: string): string {
  return module.endsWith(".js") ? module : `${module}.js`;
}

export interface CoverageReport {
  inspectedAt: string;
  groups: {
    id: string;
    description: string;
    deployed: boolean;
    missing: string[];
  }[];
  webCalls: { checked: number; missing: string[] };
  complete: boolean;
}

export function coverageReport(
  inspection: unknown,
  webCalls: readonly RequiredFunction[],
): CoverageReport {
  const parsed = inspectionZ.parse(inspection);
  const root = parsed.modules.find((entry) => entry.componentId === null);
  if (!root) throw new Error("Inspection has no root component modules.");
  const modules = new Map(root.modules.map((module) => [module.path, module]));
  const crons = new Set(
    root.modules.flatMap((module) => module.crons.map((c) => c.identifier)),
  );
  const routes = (modules.get("http.js")?.functions ?? []).map((f) => f.name);
  const hasFunction = ({ module, name }: RequiredFunction) =>
    modules
      .get(modulePath(module))
      ?.functions.some(
        (candidate) =>
          candidate.name === name || candidate.name.endsWith(`:${name}`),
      ) ?? false;
  // Prefix routes may be listed with a wildcard or suffix; match the prefix.
  const hasRoute = (route: string) =>
    routes.some((name) => name === route || name.startsWith(route));

  const groups = COVERAGE_GROUPS.map((group) => {
    const missing = [
      ...group.functions
        .filter((required) => !hasFunction(required))
        .map(({ module, name }) => `${module}:${name}`),
      ...group.httpRoutes
        .filter((route) => !hasRoute(route))
        .map((route) => `route ${route}`),
      ...group.crons
        .filter((cron) => !crons.has(cron))
        .map((cron) => `cron ${cron}`),
    ];
    return {
      id: group.id,
      description: group.description,
      deployed: missing.length === 0,
      missing,
    };
  });
  const missingWebCalls = webCalls
    .filter((call) => !hasFunction(call))
    .map(({ module, name }) => `${module}:${name}`);
  return {
    inspectedAt: parsed.finishedAt,
    groups,
    webCalls: { checked: webCalls.length, missing: missingWebCalls },
    complete:
      groups.every((group) => group.deployed) && missingWebCalls.length === 0,
  };
}
