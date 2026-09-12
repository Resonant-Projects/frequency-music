#!/usr/bin/env -S vpx tsx

// Inherited credentials only. Never load .env files or invoke a secret resolver.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  compareDeployedModules,
  readDeployedModuleHashes,
} from "./lib/convex-provenance";
import { validateOpsOrigin } from "./lib/frequency-queue-evidence";

try {
  const [manifestPath, expectedSourceSha, origin, ...extra] =
    process.argv.slice(2);
  if (
    !manifestPath ||
    !expectedSourceSha ||
    !/^[a-f0-9]{40}$/.test(expectedSourceSha) ||
    !origin ||
    extra.length
  ) {
    throw new Error(
      "Expected manifest path, reviewed source SHA, and deployment origin",
    );
  }
  const target = validateOpsOrigin(origin);
  const path = resolve(manifestPath);
  if (statSync(path).size > 4 * 1024 * 1024)
    throw new Error("Manifest too large");
  const manifestBytes = readFileSync(path);
  const verification = spawnSync(
    "gh",
    [
      "attestation",
      "verify",
      path,
      "--repo",
      "Resonant-Projects/frequency-music",
      "--signer-workflow",
      "Resonant-Projects/frequency-music/.github/workflows/convex-provenance.yml",
      "--source-digest",
      expectedSourceSha,
      "--source-ref",
      "refs/heads/main",
      "--deny-self-hosted-runners",
      "--format",
      "json",
    ],
    { encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
  );
  if (verification.error || verification.status !== 0)
    throw new Error("Attestation verification failed");
  // Prevent a changed file between reading it and gh verifying its bytes.
  if (!manifestBytes.equals(readFileSync(path)))
    throw new Error("Manifest changed during verification");
  const deployed = await readDeployedModuleHashes(
    target,
    process.env.CONVEX_SELF_HOSTED_ADMIN_KEY ?? "",
  );
  const result = compareDeployedModules(
    JSON.parse(manifestBytes.toString("utf8")),
    deployed,
  );
  console.log(
    JSON.stringify(
      {
        target,
        observedAt: new Date().toISOString(),
        ...result,
        attestedSourceSha: expectedSourceSha,
        manifestSha256: createHash("sha256")
          .update(manifestBytes)
          .digest("hex"),
        scope:
          "root-function-modules-only; excludes schema, components, environment and worker image",
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    "Deployment provenance verification failed. Check the trusted release artifact, modern gh attestation support, target, existing admin credential, and deployed artifact match. No backend response or credentials are emitted.",
  );
  process.exitCode = 1;
}
