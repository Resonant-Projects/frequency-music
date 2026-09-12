#!/usr/bin/env -S vpx tsx

// Deliberately uses inherited environment only: no .env or secret resolver.
import { collectQueueEvidence } from "./lib/frequency-queue-evidence";

try {
  const [origin, pageSize = "100", ...extra] = process.argv.slice(2);
  if (!origin || extra.length) throw new Error("Invalid arguments");
  const evidence = await collectQueueEvidence(
    origin,
    process.env.CONVEX_SELF_HOSTED_ADMIN_KEY ?? "",
    Number(pageSize),
  );
  console.log(JSON.stringify(evidence, null, 2));
} catch {
  // Backend error text can contain function arguments. Never print it.
  console.error(
    "Queue evidence failed; no complete snapshot. Check target, existing admin credential, deployed interface, page size, and snapshot limits. No backend error body is emitted.",
  );
  process.exitCode = 1;
}
