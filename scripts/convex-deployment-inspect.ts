#!/usr/bin/env -S vpx tsx
// Inherited environment only; no .env loading or credential discovery.
import { inspectDeployment } from "./lib/convex-deployment-inspect";

try {
  const [origin, ...extra] = process.argv.slice(2);
  if (!origin || extra.length) throw new Error("Invalid arguments");
  console.log(
    JSON.stringify(
      await inspectDeployment(
        origin,
        process.env.CONVEX_SELF_HOSTED_ADMIN_KEY ?? "",
      ),
      null,
      2,
    ),
  );
} catch {
  // Backend bodies/errors may contain credentials or arguments.
  console.error(
    JSON.stringify({
      status: "failed",
      code: "deployment_inspection_failed",
      complete: false,
    }),
  );
  process.exitCode = 1;
}
