import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
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

/** Inspection-v1 shape with the given root functions, routes and crons. */
function inspection(
  functions: RequiredFunction[],
  routes: string[] = [],
  crons: string[] = [],
) {
  const byModule = new Map<string, string[]>();
  for (const { module, name } of functions) {
    byModule.set(`${module}.js`, [
      ...(byModule.get(`${module}.js`) ?? []),
      name,
    ]);
  }
  byModule.set("http.js", [...(byModule.get("http.js") ?? []), ...routes]);
  return {
    format: "frequency-deployment-inspection-v1",
    finishedAt: "2026-10-17T00:00:00.000Z",
    modules: [
      {
        componentId: null,
        modules: [
          ...[...byModule].map(([path, names]) => ({
            path,
            functions: names.map((name) => ({
              name,
              udfType: "Query",
              visibility: { kind: "public" },
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
const allRoutes = ["POST /discord/interactions", "POST /telegram/webhook/*"];
const allCrons = COVERAGE_GROUPS.flatMap((group) => group.crons);

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
    for (const cron of allCrons) {
      expect(convexSource("crons")).toContain(`"${cron}"`);
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
      inspection([...allRequired, ...web], allRoutes, allCrons),
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
        ["POST /discord/interactions-test", "POST /telegram/webhook/one-token"],
        allCrons,
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
                functions: [{ name: "listWeb" }],
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

  test("rejects an unknown inspection format", () => {
    expect(() => coverageReport({ format: "other" }, [])).toThrow();
  });
});
