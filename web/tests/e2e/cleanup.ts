/**
 * E2E Test Cleanup Utility
 *
 * Deletes all test artifacts created during an E2E test run.
 * Call from afterAll() in each test file to prevent data pollution.
 */
import { execSync } from "node:child_process";

function requireBypassSecret(): string {
  const bypass =
    process.env.AUTH_BYPASS_SECRET ?? process.env.DEV_BYPASS_SECRET;
  if (!bypass) {
    throw new Error(
      "AUTH_BYPASS_SECRET (or DEV_BYPASS_SECRET) is required for e2e cleanup — set it in web/.env.local or run via `varlock run --`",
    );
  }
  return bypass;
}

function convexRun(fn: string, args: Record<string, unknown>): string {
  try {
    return execSync(`bunx convex run ${fn} '${JSON.stringify(args)}'`, {
      encoding: "utf-8",
      timeout: 15_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

/**
 * Delete a single record by table and ID.
 */
function deleteRecord(
  table:
    | "sources"
    | "hypotheses"
    | "recipes"
    | "compositions"
    | "listening"
    | "weeklyBriefs",
  id: string,
): boolean {
  try {
    convexRun(`${table}:deleteById`, {
      id,
      devBypassSecret: requireBypassSecret(),
    });
    return true;
  } catch {
    return false;
  }
}

function deleteFeed(id: string): boolean {
  try {
    convexRun("feeds:remove", { id, devBypassSecret: requireBypassSecret() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Tracks all E2E-created record IDs for cleanup.
 */
export class E2ECleanupTracker {
  private records: Array<{
    table:
      | "sources"
      | "hypotheses"
      | "recipes"
      | "compositions"
      | "listening"
      | "weeklyBriefs"
      | "feeds";
    id: string;
  }> = [];

  track(
    table:
      | "sources"
      | "hypotheses"
      | "recipes"
      | "compositions"
      | "listening"
      | "weeklyBriefs"
      | "feeds",
    id: string,
  ) {
    this.records.push({ table, id });
  }

  /**
   * Delete all tracked records in reverse order (respecting foreign key deps).
   */
  async cleanup(): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;

    // Delete in reverse order (children before parents)
    for (const record of this.records.toReversed()) {
      const success =
        record.table === "feeds"
          ? deleteFeed(record.id)
          : deleteRecord(record.table, record.id);
      if (success) deleted++;
      else failed++;
    }

    this.records = [];
    return { deleted, failed };
  }
}

/**
 * Standalone cleanup by runId pattern — searches all tables for E2E artifacts
 * matching the given runId and deletes them. Use as a safety net.
 */
export async function cleanupByRunId(runId: string): Promise<number> {
  let deleted = 0;

  // Search and delete sources
  const sourcesJson = convexRun("sources:listByStatus", {
    status: "ingested",
    limit: 100,
  });
  try {
    const sources = JSON.parse(sourcesJson);
    for (const s of sources) {
      if (
        (s.title || "").includes(runId) ||
        (s.dedupeKey || "").includes(runId)
      ) {
        if (deleteRecord("sources", s._id)) deleted++;
      }
    }
  } catch {
    /* parse error — skip */
  }

  // Search other statuses too
  for (const status of ["text_ready", "extracted", "archived"] as const) {
    const json = convexRun("sources:listByStatus", { status, limit: 100 });
    try {
      const sources = JSON.parse(json);
      for (const s of sources) {
        if (
          (s.title || "").includes(runId) ||
          (s.dedupeKey || "").includes(runId)
        ) {
          if (deleteRecord("sources", s._id)) deleted++;
        }
      }
    } catch {
      /* parse error — skip */
    }
  }

  return deleted;
}
