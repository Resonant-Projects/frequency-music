import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { getFailureStatusForComposition } from "./failures";
import {
  compositionLineageValidator,
  compositionReturnValidator,
  listeningSessionReturnValidator,
  recipeReturnValidator,
} from "./validators";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("idea"),
        v.literal("in_progress"),
        v.literal("rendered"),
        v.literal("published"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(compositionReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    const status = args.status;

    if (status !== undefined) {
      return await ctx.db
        .query("compositions")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", status))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("compositions").order("desc").take(limit);
  },
});

export const get = query({
  args: { id: v.id("compositions") },
  returns: v.union(
    v.object({
      ...compositionReturnValidator.fields,
      recipe: v.union(recipeReturnValidator, v.null()),
      listeningSessions: v.array(listeningSessionReturnValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const composition = await ctx.db.get("compositions", args.id);
    if (!composition) return null;

    const recipe = await ctx.db.get("recipes", composition.recipeId);
    const listeningSessions = await ctx.db
      .query("listeningSessions")
      .withIndex("by_compositionId_createdAt", (q) =>
        q.eq("compositionId", composition._id),
      )
      .order("desc")
      .collect();

    return {
      ...composition,
      recipe,
      listeningSessions,
    };
  },
});

export const getLineage = query({
  args: { id: v.id("compositions") },
  returns: v.union(compositionLineageValidator, v.null()),
  handler: async (ctx, args) => {
    const composition = await ctx.db.get("compositions", args.id);
    if (!composition) return null;

    const ancestry = [];
    let cursor = composition;
    while (cursor.revisionParentId) {
      const parent = await ctx.db.get("compositions", cursor.revisionParentId);
      if (!parent) break;
      ancestry.unshift(parent);
      cursor = parent;
    }

    const children = await ctx.db
      .query("compositions")
      .withIndex("by_revisionParentId_updatedAt", (q) =>
        q.eq("revisionParentId", composition._id),
      )
      .order("desc")
      .collect();

    const recipe = await ctx.db.get("recipes", composition.recipeId);
    const hypothesis = recipe
      ? await ctx.db.get("hypotheses", recipe.hypothesisId)
      : null;
    const thesis = hypothesis?.thesisId
      ? await ctx.db.get("theses", hypothesis.thesisId)
      : null;
    const sources = hypothesis
      ? (
          await Promise.all(
            hypothesis.sourceIds.map((sourceId) =>
              ctx.db.get("sources", sourceId),
            ),
          )
        ).filter(
          (source): source is NonNullable<typeof source> => source !== null,
        )
      : [];
    const listeningSessions = await ctx.db
      .query("listeningSessions")
      .withIndex("by_compositionId_createdAt", (q) =>
        q.eq("compositionId", composition._id),
      )
      .order("desc")
      .collect();

    const latestListeningSession = listeningSessions[0];
    const failureStatus = await getFailureStatusForComposition(
      ctx.db as any,
      composition._id,
    );

    return {
      composition,
      ancestry,
      children,
      recipe,
      hypothesis,
      thesis,
      sources,
      listeningSessions,
      summary: {
        depth: ancestry.length,
        revisionVariable: composition.revisionVariable,
        hasChildren: children.length > 0,
        latestExpandVerdict: latestListeningSession?.expandVerdict,
        latestExpandability: latestListeningSession?.ratings.expandability,
        failureStatus,
      },
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    recipeId: v.id("recipes"),
    artifactType: v.optional(
      v.union(
        v.literal("microStudy"),
        v.literal("expandedStudy"),
        v.literal("fullTrack"),
      ),
    ),
    projectNotesMd: v.optional(v.string()),
    version: v.optional(v.string()),
    revisionParentId: v.optional(v.id("compositions")),
    revisionVariable: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("compositions"),
  handler: async (ctx, args) => {
    const { devBypassSecret: _devBypassSecret, ...createArgs } = args;
    const identity = await requireAuth(ctx, args);
    const recipe = await ctx.db.get("recipes", createArgs.recipeId);
    if (!recipe) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Recipe not found" });
    }
    if (
      createArgs.revisionParentId &&
      !createArgs.revisionVariable?.trim().length
    ) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "revisionVariable is required when revisionParentId is set",
      });
    }
    if (
      !createArgs.revisionParentId &&
      createArgs.revisionVariable?.trim().length
    ) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message:
          "revisionParentId is required when revisionVariable is provided",
      });
    }
    if (createArgs.revisionParentId) {
      const parent = await ctx.db.get(
        "compositions",
        createArgs.revisionParentId,
      );
      if (!parent) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Revision parent composition not found",
        });
      }
    }

    const now = Date.now();
    return await ctx.db.insert("compositions", {
      title: createArgs.title,
      recipeId: createArgs.recipeId,
      artifactType: createArgs.artifactType ?? "microStudy",
      projectNotesMd: createArgs.projectNotesMd,
      version: createArgs.version ?? "v0.1",
      revisionParentId: createArgs.revisionParentId,
      revisionVariable: createArgs.revisionVariable?.trim() || undefined,
      status: "idea",
      visibility: "private",
      createdBy:
        identity.subject === "system"
          ? "system"
          : (identity.subject as Id<"users">),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("compositions"),
    title: v.optional(v.string()),
    artifactType: v.optional(
      v.union(
        v.literal("microStudy"),
        v.literal("expandedStudy"),
        v.literal("fullTrack"),
      ),
    ),
    projectNotesMd: v.optional(v.string()),
    links: v.optional(
      v.array(
        v.object({
          label: v.string(),
          url: v.string(),
        }),
      ),
    ),
    version: v.optional(v.string()),
    diffNote: v.optional(v.string()),
    revisionParentId: v.optional(v.union(v.id("compositions"), v.null())),
    revisionVariable: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("idea"),
        v.literal("in_progress"),
        v.literal("rendered"),
        v.literal("published"),
      ),
    ),
    visibility: v.optional(
      v.union(
        v.literal("private"),
        v.literal("followers"),
        v.literal("public"),
      ),
    ),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const composition = await ctx.db.get("compositions", args.id);
    if (!composition) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Composition not found",
      });
    }

    const {
      id,
      devBypassSecret: _devBypassSecret,
      revisionParentId,
      revisionVariable,
      ...patch
    } = args;
    if (revisionParentId && !revisionVariable?.trim().length) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "revisionVariable is required when revisionParentId is set",
      });
    }
    if (
      revisionParentId === undefined &&
      revisionVariable !== undefined &&
      revisionVariable.trim().length
    ) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message:
          "revisionParentId is required when revisionVariable is provided",
      });
    }
    if (
      revisionParentId === null &&
      revisionVariable !== undefined &&
      revisionVariable.trim().length
    ) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message:
          "revisionParentId is required when revisionVariable is provided",
      });
    }
    if (revisionParentId) {
      const parent = await ctx.db.get("compositions", revisionParentId);
      if (!parent) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Revision parent composition not found",
        });
      }
    }
    await ctx.db.patch("compositions", id, {
      ...patch,
      ...(revisionParentId !== undefined
        ? {
            revisionParentId:
              revisionParentId === null ? undefined : revisionParentId,
          }
        : {}),
      ...(revisionVariable !== undefined
        ? { revisionVariable: revisionVariable.trim() || undefined }
        : {}),
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Delete a composition by ID
 */
export const deleteById = mutation({
  args: { id: v.id("compositions"), devBypassSecret: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    await ctx.db.delete(args.id);
    return null;
  },
});
