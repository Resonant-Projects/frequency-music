#!/usr/bin/env -S vpx tsx
// Dry-run by default: prints the plan and contacts nothing. `--execute` uses the
// inherited CONVEX_SELF_HOSTED_ADMIN_KEY only, without .env or Varlock loading.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { validateOpsOrigin } from "./lib/frequency-queue-evidence";
import {
  BACKFILL_FUNCTION,
  backfillOutcome,
  describeBackfillPlan,
  initialBackfillState,
  parseBackfillState,
  runRevisionBackfill,
  type BackfillState,
  type BackfillTable,
} from "./lib/wave2-rollout";

function fail(code: string, exitCode = 1): never {
  // Backend errors can echo arguments or credentials; report a code only.
  console.error(JSON.stringify({ status: "failed", code }));
  process.exit(exitCode);
}

let values;
try {
  ({ values } = parseArgs({
    options: {
      execute: { type: "boolean", default: false },
      origin: { type: "string" },
      state: { type: "string" },
      "batch-size": { type: "string" },
      "max-pages": { type: "string" },
      reverify: { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  }));
} catch {
  fail("invalid_arguments", 2);
}
let target: string;
try {
  target = validateOpsOrigin(values.origin ?? "");
} catch {
  fail("invalid_origin", 2);
}
const batchSize = values["batch-size"] ? Number(values["batch-size"]) : 50;
const maxPages = values["max-pages"] ? Number(values["max-pages"]) : undefined;
if (maxPages !== undefined && (!Number.isInteger(maxPages) || maxPages < 1))
  fail("invalid_max_pages", 2);

let state: BackfillState;
try {
  state =
    values.state && existsSync(values.state)
      ? parseBackfillState(
          JSON.parse(readFileSync(values.state, "utf8")),
          target,
        )
      : initialBackfillState(target, batchSize);
} catch {
  fail("invalid_state", 2);
}
if (values.reverify)
  for (const table of Object.keys(state.tables) as BackfillTable[])
    state.tables[table].verify = {
      cursor: null,
      done: false,
      pages: 0,
      updated: 0,
    };

if (!values.execute) {
  console.log(JSON.stringify(describeBackfillPlan(state), null, 2));
  process.exit(0);
}
const statePath: string = values.state || fail("state_file_required", 2);
const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;
if (!adminKey) fail("admin_key_not_inherited", 2);

function checkpoint(next: BackfillState) {
  const temporary = `${statePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporary, statePath);
}
const client = new ConvexHttpClient(target, { logger: false });
// The SDK intentionally hides this admin-only API from its public typings.
(client as ConvexHttpClient & { setAdminAuth(key: string): void }).setAdminAuth(
  adminKey,
);
const backfill = makeFunctionReference<
  "mutation",
  { table: BackfillTable; cursor: string | null; batchSize: number },
  unknown
>(BACKFILL_FUNCTION);

checkpoint(state);
try {
  state = await runRevisionBackfill({
    state,
    maxPages,
    checkpoint,
    call: (args) => client.mutation(backfill, args),
  });
} catch {
  fail("backfill_page_failed");
}
const outcome = backfillOutcome(state);
console.log(JSON.stringify({ target, statePath, ...outcome }, null, 2));
// 0: complete and verified; 3: stopped at --max-pages; 4: verification found rows.
process.exitCode = !outcome.complete ? 3 : outcome.verified ? 0 : 4;
