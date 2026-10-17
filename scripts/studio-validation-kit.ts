#!/usr/bin/env -S vpx tsx
// Writes the plan 11 studio validation packet to a new directory. Offline:
// reads no environment, credentials or network, and never contacts Convex.
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildStudioPacket } from "./lib/studio-validation-kit";

function fail(message: string): never {
  console.error(JSON.stringify({ status: "failed", message }));
  process.exit(2);
}

let out: string | undefined;
try {
  ({
    values: { out },
  } = parseArgs({ options: { out: { type: "string" } }, strict: true }));
} catch {
  fail("Usage: studio-validation-kit.ts --out <new or empty directory>");
}
if (!out)
  fail("Usage: studio-validation-kit.ts --out <new or empty directory>");
const root = resolve(out);
let existing: string[] = [];
try {
  existing = readdirSync(root);
} catch {
  // Missing directory: created below.
}
if (existing.length > 0) fail(`${root} is not empty; choose a new directory.`);

const packet = buildStudioPacket();
for (const file of packet.files) {
  const target = join(root, file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.contents);
}
const manifest = {
  generator: "scripts/studio-validation-kit.ts",
  kits: packet.kits.map((kit) => ({
    slug: kit.slug,
    name: kit.name,
    notes: kit.notes.length,
    durationSecs: kit.plan.durationSecs,
  })),
  files: packet.manifest,
};
writeFileSync(
  join(root, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    { status: "written", directory: root, kits: manifest.kits },
    null,
    2,
  ),
);
