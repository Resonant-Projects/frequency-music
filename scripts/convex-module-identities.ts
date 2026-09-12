#!/usr/bin/env -S vpx tsx

// Inherited credentials only. Returns validated module metadata, never raw config.
import { readDeployedModuleHashes } from "./lib/convex-provenance";
import { validateOpsOrigin } from "./lib/frequency-queue-evidence";

try {
  const [origin, ...extra] = process.argv.slice(2);
  if (!origin || extra.length)
    throw new Error("One deployment origin required");
  const target = validateOpsOrigin(origin);
  const startedAt = new Date().toISOString();
  const identities = await readDeployedModuleHashes(
    target,
    process.env.CONVEX_SELF_HOSTED_ADMIN_KEY ?? "",
  );
  console.log(
    JSON.stringify(
      {
        target,
        startedAt,
        observedAt: new Date().toISOString(),
        ...identities,
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    "Module identity capture failed; no complete identities emitted. Check approved target, existing admin access, response contract and limits. No backend body emitted.",
  );
  process.exitCode = 1;
}
