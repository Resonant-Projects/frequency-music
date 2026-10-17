#!/usr/bin/env -S vpx tsx
// Offline: compares a saved deployment inspection with the Listen-first
// capabilities and the web's current `api.*` calls. Reads no environment or
// credential and makes no network call. Exit 0 complete, 3 incomplete,
// 2 invalid arguments or inspection file.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  coverageReport,
  webApiReferences,
} from "./lib/wave2-deployment-coverage";

function* sourceFiles(directory: string): Generator<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name)
    )
      yield path;
  }
}

const [inspectionPath, ...extra] = process.argv.slice(2);
if (!inspectionPath || extra.length) {
  console.error(
    JSON.stringify({
      status: "failed",
      code: "usage",
      usage: "wave2-deployment-coverage.ts <saved inspection JSON>",
    }),
  );
  process.exit(2);
}

let report;
try {
  const webSources = [
    ...sourceFiles(join(import.meta.dirname, "../web/src")),
  ].map((path) => readFileSync(path, "utf8"));
  report = coverageReport(
    JSON.parse(readFileSync(inspectionPath, "utf8")),
    webApiReferences(webSources),
  );
} catch {
  console.error(
    JSON.stringify({ status: "failed", code: "invalid_inspection" }),
  );
  process.exit(2);
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.complete ? 0 : 3;
