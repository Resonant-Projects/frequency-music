#!/usr/bin/env -S vpx tsx
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { deployedModuleDelta } from "./lib/convex-provenance";

// Offline inputs only. This does not attest either input or contact a backend.
try {
  const [release, deployed, ...extra] = process.argv.slice(2);
  if (!release || !deployed || extra.length)
    throw new Error("Two files required");
  for (const path of [release, deployed]) {
    if (statSync(path).size > 4 * 1024 * 1024)
      throw new Error("Input exceeds 4 MiB");
  }
  const releaseBytes = readFileSync(release);
  const deployedBytes = readFileSync(deployed);
  console.log(
    JSON.stringify(
      {
        releaseManifestSha256: createHash("sha256")
          .update(releaseBytes)
          .digest("hex"),
        deployedIdentitiesSha256: createHash("sha256")
          .update(deployedBytes)
          .digest("hex"),
        ...deployedModuleDelta(
          JSON.parse(releaseBytes.toString("utf8")),
          JSON.parse(deployedBytes.toString("utf8")),
        ),
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    "Offline module delta failed: expected a release manifest and sanitized {moduleHashes:[{path,environment,hash}]} evidence, each at most 4 MiB. No input contents emitted.",
  );
  process.exitCode = 1;
}
