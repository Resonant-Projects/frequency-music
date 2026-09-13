#!/usr/bin/env -S vpx tsx
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { moduleIdentityDelta } from "./lib/convex-provenance";

// Offline inputs only: two sanitized {moduleHashes:[{path,environment,hash}]}
// files, for example the retained deployed observation and an isolated
// restore's observation. Equality proves artifact identity between the two
// observations, never provenance, and never authorizes deployment or rollback.
try {
  const [left, right, ...extra] = process.argv.slice(2);
  if (!left || !right || extra.length) throw new Error("Two files required");
  for (const path of [left, right]) {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > 4 * 1024 * 1024)
      throw new Error("Input must be a regular file no larger than 4 MiB");
  }
  const leftBytes = readFileSync(left);
  const rightBytes = readFileSync(right);
  console.log(
    JSON.stringify(
      {
        leftSha256: createHash("sha256").update(leftBytes).digest("hex"),
        rightSha256: createHash("sha256").update(rightBytes).digest("hex"),
        ...moduleIdentityDelta(
          JSON.parse(leftBytes.toString("utf8")),
          JSON.parse(rightBytes.toString("utf8")),
        ),
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    "Offline identity delta failed: expected two sanitized {moduleHashes:[{path,environment,hash}]} files, each at most 4 MiB. No input contents emitted.",
  );
  process.exitCode = 1;
}
