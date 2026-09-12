#!/usr/bin/env -S vpx tsx

// Deliberately uses inherited environment only: no .env or secret resolver.
import { collectQueueEvidence } from "./lib/frequency-queue-evidence";

import { queueFailureReport } from "./lib/queue-diagnostics";

try {
  const [origin, pageSize = "100", ...extra] = process.argv.slice(2);
  if (!origin || extra.length) throw new Error("Invalid arguments");
  const evidence = await collectQueueEvidence(
    origin,
    process.env.CONVEX_SELF_HOSTED_ADMIN_KEY ?? "",
    Number(pageSize),
  );
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  // Backend error text can contain function arguments. Never print it.
  console.error(JSON.stringify(queueFailureReport(error)));
  process.exitCode = 1;
}
