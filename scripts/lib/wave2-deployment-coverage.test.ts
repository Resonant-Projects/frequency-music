import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { AGENT_TOOL_NAMES } from "../../convex/shared/agentToolManifest";
import {
  COVERAGE_GROUPS,
  coverageReport,
  webApiReferences,
  type RequiredFunction,
} from "./wave2-deployment-coverage";

const repoRoot = join(import.meta.dirname, "../..");

function convexSource(module: string): string {
  return readFileSync(join(repoRoot, "convex", `${module}.ts`), "utf8");
}

function webSources(directory = join(repoRoot, "web/src")): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return webSources(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [readFileSync(path, "utf8")] : [];
  });
}

/** Inspection-v1 shape with the given root functions, routes, crons and
 * active component mounts. Functions are public unless named in `internal`
 * as `module:name`. */
function inspection(
  functions: RequiredFunction[],
  routes: string[] = [],
  crons: string[] = [],
  internal: string[] = [],
  components: string[] = [],
) {
  const byModule = new Map<string, { name: string; kind: string }[]>();
  const add = (path: string, name: string, kind: string) =>
    byModule.set(path, [...(byModule.get(path) ?? []), { name, kind }]);
  for (const { module, name } of functions) {
    const kind = internal.includes(`${module}:${name}`) ? "internal" : "public";
    add(`${module}.js`, name, kind);
  }
  for (const route of routes) add("http.js", route, "public");
  return {
    format: "frequency-deployment-inspection-v1",
    finishedAt: "2026-10-17T00:00:00.000Z",
    components: [
      { path: "", state: "active" },
      ...components.map((path) => ({ path, state: "active" })),
    ],
    modules: [
      {
        componentId: null,
        modules: [
          ...[...byModule].map(([path, entries]) => ({
            path,
            functions: entries.map(({ name, kind }) => ({
              name,
              udfType: "Query",
              visibility: { kind },
            })),
            crons: [],
          })),
          {
            path: "crons.js",
            functions: [],
            crons: crons.map((identifier) => ({ identifier })),
          },
        ],
      },
    ],
  };
}

const allRequired = COVERAGE_GROUPS.flatMap((group) => group.functions);
const allRoutes = COVERAGE_GROUPS.flatMap((group) => group.httpRoutes);
const allCrons = COVERAGE_GROUPS.flatMap((group) => group.crons);
const allComponents = COVERAGE_GROUPS.flatMap((group) => group.components);
const signerRoutes = ["POST /discord/interactions", "POST /telegram/webhook/*"];

describe("wave 2 deployment coverage", () => {
  test("every required function is an export of the current source", () => {
    for (const { module, name } of allRequired) {
      expect(convexSource(module)).toMatch(
        new RegExp(`export const ${name} = `),
      );
    }
    const http = convexSource("http");
    expect(http).toContain('path: "/discord/interactions"');
    expect(http).toContain('pathPrefix: "/telegram/webhook/"');
    for (const route of allRoutes.filter((r) => !signerRoutes.includes(r))) {
      const tool = route.match(/^POST \/agent-tools\/(\w+)$/)?.[1];
      expect(AGENT_TOOL_NAMES).toContain(tool);
    }
    for (const cron of allCrons) {
      expect(convexSource("crons")).toContain(`"${cron}"`);
    }
    for (const component of allComponents) {
      expect(convexSource("convex.config")).toContain(`app.use(${component})`);
    }
  });

  test("web references resolve to exports of the current source", () => {
    const references = webApiReferences(webSources());
    expect(references.length).toBeGreaterThan(10);
    expect(references).toContainEqual({ module: "docket", name: "listWeb" });
    for (const { module, name } of references) {
      expect(convexSource(module)).toMatch(
        new RegExp(`export const ${name} = `),
      );
    }
  });

  test("a deployment carrying everything is complete", () => {
    const web = webApiReferences(webSources());
    const report = coverageReport(
      inspection(
        [...allRequired, ...web],
        allRoutes,
        allCrons,
        [],
        allComponents,
      ),
      web,
    );
    expect(report.complete).toBe(true);
    expect(report.groups.every((group) => group.deployed)).toBe(true);
    expect(report.webCalls.missing).toEqual([]);
  });

  test("a pre-Wave-2 deployment reports each missing capability and web call", () => {
    const web: RequiredFunction[] = [
      { module: "podcast", name: "subscription" },
      { module: "docket", name: "listWeb" },
    ];
    const report = coverageReport(
      inspection([{ module: "podcast", name: "subscription" }]),
      web,
    );
    expect(report.complete).toBe(false);
    expect(report.groups.find((g) => g.id === "wave2-138")?.missing).toEqual(
      expect.arrayContaining([
        "docket:listWeb",
        "decisionIntentsMigrations:backfillRevisions",
        "route POST /discord/interactions",
        "route POST /telegram/webhook/*",
        "cron rebuild-docket",
      ]),
    );
    expect(report.webCalls).toEqual({
      checked: 2,
      missing: ["docket:listWeb"],
    });
  });

  test("a longer or exact path does not satisfy a required route", () => {
    const report = coverageReport(
      inspection(
        allRequired,
        [
          ...allRoutes.filter((route) => !signerRoutes.includes(route)),
          "POST /discord/interactions-test",
          "POST /telegram/webhook/one-token",
        ],
        allCrons,
        [],
        allComponents,
      ),
      [],
    );
    expect(report.complete).toBe(false);
    expect(report.groups.find((g) => g.id === "wave2-138")?.missing).toEqual([
      "route POST /discord/interactions",
      "route POST /telegram/webhook/*",
    ]);
  });

  test("component modules do not satisfy root requirements", () => {
    const report = coverageReport(
      {
        ...inspection([]),
        modules: [
          ...inspection([]).modules,
          {
            componentId: "rag",
            modules: [
              {
                path: "docket.js",
                functions: [
                  {
                    name: "listWeb",
                    udfType: "Query",
                    visibility: { kind: "public" },
                  },
                ],
                crons: [],
              },
            ],
          },
        ],
      },
      [{ module: "docket", name: "listWeb" }],
    );
    expect(report.webCalls.missing).toEqual(["docket:listWeb"]);
  });

  test("an internal function does not satisfy a web call", () => {
    const report = coverageReport(
      inspection(
        allRequired,
        allRoutes,
        allCrons,
        ["docket:listWeb"],
        allComponents,
      ),
      [{ module: "docket", name: "listWeb" }],
    );
    expect(report.groups.every((group) => group.deployed)).toBe(true);
    expect(report.webCalls.missing).toEqual(["docket:listWeb"]);
    expect(report.complete).toBe(false);
  });

  test("an internal function satisfies a capability group", () => {
    const report = coverageReport(
      inspection(
        allRequired,
        allRoutes,
        allCrons,
        ["decisionIntentsMigrations:backfillRevisions"],
        allComponents,
      ),
      [{ module: "docket", name: "listWeb" }],
    );
    expect(report.complete).toBe(true);
  });

  test("the October 11 deployment lacks #118 onward, including the rag mount", () => {
    // Root inventory of 81150337 as observed on 2026-10-17: none of the
    // groups' functions, routes, crons or components.
    const report = coverageReport(
      inspection([{ module: "podcast", name: "subscription" }]),
      [],
    );
    expect(report.groups.map((group) => group.id)).toEqual([
      "recovery-118",
      "wave2-138",
      "audio-feedback-141",
      "rendering-140",
      "tournament-142",
      "passages-153",
    ]);
    expect(report.groups.every((group) => !group.deployed)).toBe(true);
    const passages = report.groups.find((g) => g.id === "passages-153");
    expect(passages?.missing).toEqual(
      expect.arrayContaining([
        "passages:sweep",
        "route POST /agent-tools/searchSourcePassages",
        "cron passage-index-sweep",
        "component rag",
      ]),
    );
    expect(report.groups.find((g) => g.id === "recovery-118")?.missing).toEqual(
      expect.arrayContaining([
        "operationFailures:listForRun",
        "cron normalize-legacy-extraction-history",
        "route POST /agent-tools/reportCaptureFailure",
      ]),
    );
  });

  test("a mounted but inactive or unmounted rag component is missing", () => {
    const deployed = inspection(allRequired, allRoutes, allCrons);
    const inactive = {
      ...deployed,
      components: [...deployed.components, { path: "rag", state: "unmounted" }],
    };
    for (const saved of [deployed, inactive]) {
      const report = coverageReport(saved, []);
      expect(report.complete).toBe(false);
      expect(
        report.groups.filter((group) => !group.deployed).map((g) => g.id),
      ).toEqual(["passages-153"]);
      expect(
        report.groups.find((g) => g.id === "passages-153")?.missing,
      ).toEqual(["component rag"]);
    }
  });

  test("a nested component path does not satisfy a top-level mount", () => {
    const report = coverageReport(
      inspection(allRequired, allRoutes, allCrons, [], ["rag/workpool"]),
      [],
    );
    expect(report.groups.find((g) => g.id === "passages-153")?.missing).toEqual(
      ["component rag"],
    );
  });

  test("rejects an inspection without its component list", () => {
    const { components: _omitted, ...saved } = inspection(allRequired);
    expect(() => coverageReport(saved, [])).toThrow();
  });

  test("rejects a function without its visibility", () => {
    const saved = inspection([{ module: "docket", name: "listWeb" }]);
    const root = saved.modules[0]!.modules[0]!;
    const stripped = {
      ...saved,
      modules: [
        {
          componentId: null,
          modules: [{ ...root, functions: [{ name: "listWeb" }] }],
        },
      ],
    };
    expect(() => coverageReport(stripped, [])).toThrow();
  });

  test("rejects an unknown inspection format", () => {
    expect(() => coverageReport({ format: "other" }, [])).toThrow();
  });
});
