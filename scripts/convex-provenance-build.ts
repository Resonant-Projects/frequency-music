import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { manifestFromPushRequest } from "./lib/convex-provenance";

// Deliberately no Varlock/.env import: this build has no runtime credentials.
const [output, ...extra] = process.argv.slice(2);
if (!output || extra.length) {
  throw new Error(
    "Usage: vpx tsx scripts/convex-provenance-build.ts OUTPUT.json",
  );
}
const installed = JSON.parse(
  readFileSync("node_modules/convex/package.json", "utf8"),
);
if (installed.version !== "1.34.1") {
  throw new Error(
    "Offline artifact preparation requires audited Convex CLI 1.34.1",
  );
}
const temporary = mkdtempSync(join(tmpdir(), "frequency-convex-provenance-"));
try {
  const guard = join(temporary, "deny-network.cjs");
  writeFileSync(
    guard,
    `const deny = () => { throw new Error('Offline Convex build attempted network access'); };
require('node:net').Socket.prototype.connect = deny;
require('node:dns').lookup = deny;
globalThis.fetch = deny;
`,
  );
  const envFile = join(temporary, "inert.env");
  writeFileSync(envFile, "");
  const requestPath = join(temporary, "push");
  // --dry-run alone contacts Convex. --push-all-modules skips remote hash
  // lookup; --write-push-request returns before any startPush request. Pin the
  // CLI because these are internal flags. The preload rejects socket access.
  const result = spawnSync(
    process.execPath,
    [
      "--require",
      guard,
      resolve("node_modules/convex/bin/main.js"),
      "deploy",
      "--url",
      "http://127.0.0.1:9",
      "--admin-key",
      "frequency-offline-inert",
      "--env-file",
      envFile,
      "--skip-workos-check",
      "--codegen",
      "disable",
      "--typecheck",
      "disable",
      "--dry-run",
      "--push-all-modules",
      "--write-push-request",
      requestPath,
    ],
    {
      // Explicit inert override prevents the CLI reading ~/.convex/config.json
      // in getBigBrainAuth, even with explicit URL/admin-key arguments.
      env: {
        PATH: process.env.PATH,
        CI: "true",
        CONVEX_OVERRIDE_ACCESS_TOKEN: "frequency-offline-inert",
      } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    },
  );
  if (result.status !== 0 || result.error) {
    throw new Error(`Offline Convex bundle failed: ${result.stderr}`);
  }
  const manifest = manifestFromPushRequest(
    JSON.parse(readFileSync(`${requestPath}.json`, "utf8")),
  );
  writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Wrote ${manifest.modules.length} root module hashes to ${output}`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
