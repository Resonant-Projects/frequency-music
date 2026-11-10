import { customQuery } from "convex-helpers/server/customFunctions";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { type AppIdentity, requireReader } from "./auth";

/** The most rows one gated list read returns to a signed-in user. */
export const READER_ROW_LIMIT = 200;

/**
 * Clamps a list read's row count for a signed-in user. The service identity
 * (operator scripts) keeps the limit it asked for.
 */
export function readerLimit(identity: AppIdentity, limit: number): number {
  if (identity.isBypass || identity.subject === "system") return limit;
  return Math.min(limit, READER_ROW_LIMIT);
}

/**
 * A public query that needs a signed-in user or the service secret. The
 * handler's ctx gains the caller's `identity` and `readLimit`, which is
 * `readerLimit` bound to that identity.
 */
export const readerQuery = customQuery(query, {
  args: { devBypassSecret: v.optional(v.string()) },
  input: async (ctx, args) => {
    const identity = await requireReader(ctx, args);
    const readLimit = (limit: number) => readerLimit(identity, limit);
    return { ctx: { identity, readLimit }, args: {} };
  },
});
