import { ConvexHttpClient } from "convex/browser";
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { internal } from "../../convex/_generated/api";
import {
  AGENT_RUN_STATUSES,
  type AgentRunStatus,
} from "../../convex/shared/statuses";

export const MAX_QUEUE_EVIDENCE_PAGES = 1000;
export const QUEUE_EVIDENCE_TIMEOUT_MS = 20_000;

/** Only accepts an explicit TLS deployment origin; never discovers credentials. */
export function validateOpsOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.origin !== "https://convex.resonantprojects.art" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("An explicit HTTPS deployment origin is required");
  }
  return url.origin;
}

export async function collectQueueEvidence(
  origin: string,
  adminKey: string,
  pageSize = 100,
  transport: typeof fetch = fetch,
) {
  const target = validateOpsOrigin(origin);
  if (
    !adminKey ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 200
  ) {
    throw new Error("Existing admin credential and page size 1..200 required");
  }
  const startedAt = new Date().toISOString();
  const signal = AbortSignal.timeout(QUEUE_EVIDENCE_TIMEOUT_MS);
  const client = new ConvexHttpClient(target, {
    logger: false,
    fetch: (input, init) =>
      transport(input, { ...init, signal, redirect: "error" }),
  });
  // The SDK intentionally hides this admin-only API from its public typings.
  (
    client as ConvexHttpClient & { setAdminAuth(key: string): void }
  ).setAdminAuth(adminKey);
  const internalQuery = internal.agentRuns.opsStatusCountsPage;
  // consistentQuery's public typings exclude internal functions even with
  // admin auth. Adapt visibility while retaining the generated name/contract.
  const query = makeFunctionReference<
    "query",
    FunctionArgs<typeof internalQuery>,
    FunctionReturnType<typeof internalQuery>
  >(getFunctionName(internalQuery));
  const counts = Object.fromEntries(
    AGENT_RUN_STATUSES.map((s) => [s, 0]),
  ) as Record<AgentRunStatus, number>;
  const cursors = new Set<string>();
  let cursor: string | null = null;
  let rowsRead = 0;
  let claimsPaused: boolean | undefined;
  for (let pages = 1; pages <= MAX_QUEUE_EVIDENCE_PAGES; pages++) {
    signal.throwIfAborted();
    // One client caches one timestamp. Never retry at a newer timestamp.
    const page: FunctionReturnType<
      typeof internal.agentRuns.opsStatusCountsPage
    > = await client.consistentQuery(query, { cursor, pageSize });
    if (
      page.pageStatus === "SplitRequired" ||
      typeof page.isDone !== "boolean" ||
      typeof page.claimsPaused !== "boolean" ||
      !Number.isSafeInteger(page.rowsRead) ||
      page.rowsRead < 0 ||
      page.rowsRead > 200 ||
      (claimsPaused !== undefined && claimsPaused !== page.claimsPaused)
    ) {
      throw new Error("Incomplete or inconsistent queue evidence");
    }
    claimsPaused = page.claimsPaused;
    let pageTotal = 0;
    for (const status of AGENT_RUN_STATUSES) {
      const count = page.counts?.[status];
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error("Invalid scalar counts");
      }
      counts[status] += count;
      pageTotal += count;
    }
    if (pageTotal !== page.rowsRead) throw new Error("Invalid page total");
    rowsRead += pageTotal;
    signal.throwIfAborted();
    if (page.isDone) {
      if (page.cursor !== null) throw new Error("Invalid terminal cursor");
      return {
        target,
        complete: true,
        consistency: "single-convex-query-timestamp",
        startedAt,
        finishedAt: new Date().toISOString(),
        pages,
        rowsRead,
        counts,
        claimsPaused,
        // Environment values are not database snapshot provenance.
        claimsPauseConsistency: "observed-equal-across-pages",
      };
    }
    if (
      typeof page.cursor !== "string" ||
      !page.cursor ||
      cursors.has(page.cursor)
    ) {
      throw new Error("Invalid or repeated pagination cursor");
    }
    cursor = page.cursor;
    cursors.add(cursor);
  }
  throw new Error("Queue scan page limit exceeded; no complete evidence");
}
