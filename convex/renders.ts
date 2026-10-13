// Litmus render admission (render ladder 3.2-3.3). A recipe's typed plan is
// snapshotted into an immutable media job; the media service renders it and
// mediaJobEffects applies the result. The plan 11 gate (`renderValidation`)
// is read here and at completion, and is never written by this module.
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { readSetting } from "./settings";
import {
  RENDER_VALIDATION_KEY,
  RENDERER_VERSION_FOR_JOBS,
} from "./shared/mediaJobs";
import { admitRenderPlan } from "./shared/renderPlan";

export async function renderValidationIsGo(
  ctx: Pick<QueryCtx, "db">,
): Promise<boolean> {
  return (await readSetting(ctx, RENDER_VALIDATION_KEY)) === "go";
}

function invalidPlan(error: unknown): ConvexError<{
  code: string;
  message: string;
}> {
  const detail =
    error instanceof z.ZodError
      ? error.issues
          .slice(0, 5)
          .map(
            (issue) =>
              `${issue.path.length ? issue.path.join(".") : "plan"}: ${issue.message}`,
          )
          .join("; ")
      : String(error);
  return new ConvexError({
    code: "INVALID_ARGUMENT",
    message: `Invalid render plan: ${detail}`.slice(0, 1000),
  });
}

type RequestResult = { jobId: Id<"mediaJobs">; created: boolean };

// Explicit return types break the api.d.ts <-> internal.* inference cycle.
async function admit(
  ctx: MutationCtx,
  recipeId: Id<"recipes">,
): Promise<RequestResult> {
  const recipe = await ctx.db.get(recipeId);
  if (!recipe) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Recipe not found" });
  }
  if (!recipe.renderPlan) {
    throw new ConvexError({
      code: "INVALID_STATE",
      message: "Recipe needs a typed render plan",
    });
  }
  let renderPlan;
  try {
    // Re-admit the stored plan: limits may have tightened since it was saved.
    renderPlan = admitRenderPlan(recipe.renderPlan);
  } catch (error) {
    throw invalidPlan(error);
  }
  // Spec 2: study families follow the go decision; until then only the
  // single baseline litmus render the spike and blind comparison need.
  if (renderPlan.variable && !(await renderValidationIsGo(ctx))) {
    throw new ConvexError({
      code: "INVALID_STATE",
      message:
        "Study families require renderValidation=go; remove the plan variable to render the baseline",
    });
  }
  return await ctx.runMutation(internal.mediaJobs.enqueue, {
    input: {
      kind: "litmusRender",
      recipeId,
      recipeUpdatedAt: recipe.updatedAt,
      renderPlan,
      rendererVersion: RENDERER_VERSION_FOR_JOBS,
    },
  });
}

const requestReturn = v.object({
  jobId: v.id("mediaJobs"),
  created: v.boolean(),
});

/** Enqueue a litmus render of the recipe's current plan. Repeating the same
 * request returns the queued, running, or finished job instead of a copy. */
export const request = mutation({
  args: { recipeId: v.id("recipes"), devBypassSecret: v.optional(v.string()) },
  returns: requestReturn,
  handler: async (ctx, args): Promise<RequestResult> => {
    await requireAuth(ctx, args);
    return await admit(ctx, args.recipeId);
  },
});

export const requestInternal = internalMutation({
  args: { recipeId: v.id("recipes") },
  returns: requestReturn,
  handler: async (ctx, args): Promise<RequestResult> =>
    await admit(ctx, args.recipeId),
});

/** Set or clear a recipe's render plan. Saving bumps the recipe revision, so
 * a later request snapshots a new job. */
export const setPlan = mutation({
  args: {
    recipeId: v.id("recipes"),
    // null clears the plan; anything else must pass renderPlanZ.
    renderPlan: v.any(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Recipe not found" });
    }
    let renderPlan;
    if (args.renderPlan !== null) {
      try {
        renderPlan = admitRenderPlan(args.renderPlan);
      } catch (error) {
        throw invalidPlan(error);
      }
    }
    await ctx.db.patch(args.recipeId, { renderPlan, updatedAt: Date.now() });
    return null;
  },
});

/** Read-only gate state for clients; no public function changes it. */
export const validationGate = query({
  args: { devBypassSecret: v.optional(v.string()) },
  returns: v.union(v.literal("go"), v.literal("unvalidated")),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return (await renderValidationIsGo(ctx)) ? "go" : "unvalidated";
  },
});
