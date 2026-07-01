import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireAuth } from "./auth";

// ============================================================================
// EDIT CAPTURES - human edits of AI/agent-generated content become eval data
// ============================================================================
// Written from inside the existing edit mutations whenever the edited row has
// AI/agent origin. The export script curates these into golden-dataset
// candidates (plan 05 self-improvement loop).

export type EditCaptureEntity = "extraction" | "hypothesis" | "weeklyBrief";

/** Pure row builder (unit-testable without a DB harness). */
export function buildEditCaptureRow(input: {
  entityType: EditCaptureEntity;
  entityId: string;
  generated: unknown;
  edited: unknown;
  promptVersion?: string;
  model?: string;
  now: number;
}) {
  return {
    entityType: input.entityType,
    entityId: input.entityId,
    ...(input.promptVersion ? { promptVersion: input.promptVersion } : {}),
    ...(input.model ? { model: input.model } : {}),
    generated: input.generated,
    edited: input.edited,
    editedAt: input.now,
    exported: false,
  };
}

/** Insert a capture row; call from within an edit mutation. */
export async function recordEditCapture(
  ctx: MutationCtx,
  input: {
    entityType: EditCaptureEntity;
    entityId: string;
    generated: unknown;
    edited: unknown;
    promptVersion?: string;
    model?: string;
    now?: number;
  },
) {
  return await ctx.db.insert(
    "editCaptures",
    buildEditCaptureRow({ ...input, now: input.now ?? Date.now() }),
  );
}

export const listUnexported = query({
  args: { limit: v.optional(v.number()), devBypassSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 100), 500));
    return await ctx.db
      .query("editCaptures")
      .withIndex("by_exported_editedAt", (q) => q.eq("exported", false))
      .order("asc")
      .take(limit);
  },
});

export const markExported = mutation({
  args: {
    ids: v.array(v.id("editCaptures")),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    for (const id of args.ids) {
      await ctx.db.patch(id, { exported: true });
    }
    return { marked: args.ids.length };
  },
});
