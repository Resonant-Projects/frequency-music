import { z } from "zod";

/**
 * Offline reading of a saved `scripts/convex-deployment-inspect.ts` result.
 * Answers which capabilities merged since the 2026-10-11 deployment (#118
 * onward) the deployed root component and its component mounts carry, and
 * which functions the current web source calls that it lacks. Reads no
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
  /** Mounted component paths, which must be active. */
  components: string[];
}

const fn = (module: string, ...names: string[]): RequiredFunction[] =>
  names.map((name) => ({ module, name }));

// convex/http.ts registers one POST route per agent tool name.
const agentToolRoutes = (...names: string[]): string[] =>
  names.map((name) => `POST /agent-tools/${name}`);

/** Backend capabilities each merged PR adds, in deployment order. */
export const COVERAGE_GROUPS: readonly CoverageGroup[] = Object.freeze([
  {
    id: "recovery-118",
    description: "Pipeline recovery and legacy extraction history (#118)",
    functions: [
      ...fn("operationFailures", "listForRun", "reconcile", "dispatch"),
      ...fn("recoveryWorkflows", "start"),
      ...fn("extractInternal", "reconcileAttempts"),
      ...fn("extractions", "normalizeLegacyHistory"),
    ],
    httpRoutes: agentToolRoutes(
      "reportCaptureFailure",
      "getCaptureRecovery",
      "finishCaptureRecovery",
      "getFailureInvestigation",
      "submitFailureDiagnosis",
    ),
    crons: [
      "normalize-legacy-extraction-history",
      "reconcile-extraction-attempts",
      "reconcile-operation-recovery",
    ],
    components: [],
  },
  {
    id: "wave2-138",
    description: "Wave 2 docket, signed decisions and revision backfill (#138)",
    functions: [
      ...fn("docket", "listWeb", "prepare"),
      ...fn("decisionIntents", "get", "applyWeb", "deferWeb", "cancelWeb"),
      ...fn("decisionIntentsMigrations", "backfillRevisions"),
    ],
    httpRoutes: [
      "POST /discord/interactions",
      "POST /telegram/webhook/*",
      ...agentToolRoutes(
        "listDocket",
        "getDocketCard",
        "proposeDecision",
        "proposeListening",
        "recordDocketDelivery",
      ),
    ],
    crons: ["rebuild-docket"],
    components: [],
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
    components: [],
  },
  {
    id: "rendering-140",
    description: "Litmus render jobs (#140)",
    functions: fn("renders", "request", "setPlan", "validationGate"),
    httpRoutes: [],
    crons: [],
    components: [],
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
    httpRoutes: agentToolRoutes(
      "requestTournamentRun",
      "listTournamentSeeds",
      "hydrateClaims",
      "beginTournamentRun",
      "embedTournamentStatement",
      "findTournamentNeighbors",
      "searchTournamentEvidence",
      "recordHypothesisCandidates",
      "completeTournamentRun",
      "submitTournamentDraft",
      "finalizeTournamentRun",
    ),
    crons: [],
    components: [],
  },
  {
    id: "passages-153",
    description: "Passage index, RAG component and searchSourcePassages (#153)",
    functions: fn(
      "passages",
      "indexSource",
      "removeSource",
      "sweep",
      "searchForAgent",
      "setIndexingEnabled",
      "backfillBatch",
      "probe",
    ),
    httpRoutes: agentToolRoutes("searchSourcePassages"),
    crons: ["passage-index-sweep"],
    components: ["rag"],
  },
  {
    // Not in the 91cb3047 release pin: a checkout carrying this candidate
    // reports the group missing until its own attested release is deployed.
    // The `studioComparison` blind-group purpose ships in the same schema
    // push; the inspection carries only a schema hash, so the module stands
    // in for it.
    id: "studio-comparison",
    description:
      "Human studio renders rated blind against machine litmus renders (plan 11 step 3; unmerged candidate)",
    functions: fn(
      "studioComparisons",
      "beginUpload",
      "finishContext",
      "finishUpload",
      "rejectUpload",
      "completeUpload",
      "list",
      "get",
      "machineCandidates",
      "submitRatings",
    ),
    httpRoutes: [],
    crons: [],
    components: [],
  },
  {
    id: "zodiac-domain-sectors",
    description:
      "Atlas items placed by their classified concepts' domains (plan Phase E; unmerged candidate)",
    functions: fn("dashboard", "conceptSectors"),
    httpRoutes: [],
    crons: [],
    components: [],
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
  components: z.array(z.object({ path: z.string(), state: z.string() })),
  modules: z.array(
    z.object({
      componentId: z.string().nullable(),
      modules: z.array(
        z.object({
          path: z.string(),
          functions: z.array(
            z.object({
              name: z.string(),
              visibility: z.object({ kind: z.enum(["public", "internal"]) }),
            }),
          ),
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
  const routes = new Set(
    (modules.get("http.js")?.functions ?? []).map((f) => f.name),
  );
  // Capability groups only need the function deployed (the revision backfill
  // is internal); a browser call also needs it public.
  const hasFunction = (
    { module, name }: RequiredFunction,
    requirePublic = false,
  ) =>
    modules
      .get(modulePath(module))
      ?.functions.some(
        (candidate) =>
          (candidate.name === name || candidate.name.endsWith(`:${name}`)) &&
          (!requirePublic || candidate.visibility.kind === "public"),
      ) ?? false;
  // Convex lists an exact route by its path and a prefix route as
  // `<prefix>*` (convex/src/server/router.ts getRoutes), so match exactly:
  // a longer path never stands in for the required one.
  const hasRoute = (route: string) => routes.has(route);
  // The root component lists with an empty path; a mount counts once active.
  const activeComponents = new Set(
    parsed.components
      .filter((component) => component.state === "active")
      .map((component) => component.path),
  );

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
      ...group.components
        .filter((component) => !activeComponents.has(component))
        .map((component) => `component ${component}`),
    ];
    return {
      id: group.id,
      description: group.description,
      deployed: missing.length === 0,
      missing,
    };
  });
  const missingWebCalls = webCalls
    .filter((call) => !hasFunction(call, true))
    .map(({ module, name }) => `${module}:${name}`);
  return {
    inspectedAt: parsed.finishedAt,
    groups,
    webCalls: { checked: webCalls.length, missing: missingWebCalls },
    complete:
      groups.every((group) => group.deployed) && missingWebCalls.length === 0,
  };
}
