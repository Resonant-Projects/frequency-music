/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getSeedConceptDomainEntries } from "./domainMappings";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { normalizeConceptDomainSlug } from "./conceptDomainNormalization";
import { registryStatusValidator } from "./schema";
import { DECISION_NOTE_MAX_LENGTH } from "./shared/vocabularyTriage";

const KNOWN_PARAMETER_KINDS = new Set([
  "tempo",
  "key",
  "tuningSystem",
  "rootNote",
  "chordProgression",
  "rhythm",
  "instrument",
  "synthWaveform",
  "harmonicProfile",
  "frequency",
  "note",
]);

const KNOWN_CONCEPT_DOMAINS = new Set([
  "tuning",
  "acoustics",
  "psychoacoustics",
  "theory",
  "production",
  "mathematics",
  "geometry",
  "instrument",
  "general",
]);

const KNOWN_RELATIONSHIP_KINDS = new Set([
  "cites",
  "related_to",
  "contradicts",
  "supports",
  "mentions",
  "defines",
  "tests",
  "applies",
  "is_a",
  "part_of",
  "derived_from",
  "extracted_from",
  "generated_from",
  "implements",
]);

const PROVISIONAL_STATUS = "provisional" as const;
const RELATIONSHIP_INLINE_MERGE_LIMIT = 2_000;
const MENTION_COUNT_CAP = 500;

const vocabularyListValidator = v.union(
  v.literal("conceptDomain"),
  v.literal("parameterKind"),
  v.literal("relationshipKind"),
);

type VocabularyList = "conceptDomain" | "parameterKind" | "relationshipKind";

const vocabularyTables = {
  conceptDomain: "conceptDomains",
  parameterKind: "parameterKinds",
  relationshipKind: "relationshipKinds",
} as const;

function triageError(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

function decisionNote(note?: string) {
  const normalized = note?.trim();
  if (normalized && normalized.length > DECISION_NOTE_MAX_LENGTH) {
    triageError(
      "NOTE_TOO_LONG",
      `Decision notes must be ${DECISION_NOTE_MAX_LENGTH} characters or less`,
    );
  }
  return normalized || undefined;
}

function decidedBy(identity: Awaited<ReturnType<typeof requireAuth>>) {
  return identity.isBypass ? "system" : identity.subject;
}

async function resolveRegistryEntry(
  ctx: MutationCtx,
  list: VocabularyList,
  entryId: string,
) {
  const table = vocabularyTables[list];
  const normalizedId = ctx.db.normalizeId(table, entryId);
  if (!normalizedId) {
    return triageError(
      "WRONG_VOCABULARY_LIST",
      "Entry id does not belong to the named vocabulary list",
    );
  }
  const entry = await ctx.db.get(normalizedId);
  if (!entry) {
    return triageError("ENTRY_NOT_FOUND", "Vocabulary entry not found");
  }
  return entry;
}

function requireProvisional(entry: { status: string }) {
  if (entry.status !== "provisional") {
    triageError(
      "STALE_VOCABULARY_DECISION",
      "Vocabulary entry must still be provisional",
    );
  }
}

export async function getNonDeprecatedConceptDomains(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
) {
  const [known, provisional, experimental] = await Promise.all([
    ctx.db
      .query("conceptDomains")
      .withIndex("by_status", (q) => q.eq("status", "known"))
      .collect(),
    ctx.db
      .query("conceptDomains")
      .withIndex("by_status", (q) => q.eq("status", "provisional"))
      .collect(),
    ctx.db
      .query("conceptDomains")
      .withIndex("by_status", (q) => q.eq("status", "experimental"))
      .collect(),
  ]);
  return [...known, ...provisional, ...experimental];
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function inferStatus(
  name: string,
  knownSet: Set<string>,
): "known" | "provisional" {
  return knownSet.has(name) ? "known" : "provisional";
}

export const ensureParameterKind = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.object({
    status: registryStatusValidator,
  }),
  handler: async (ctx, args) => {
    const name = normalizeName(args.name);
    if (!name) return { status: PROVISIONAL_STATUS };

    const existing = await ctx.db
      .query("parameterKinds")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (existing) return { status: existing.status };

    const now = Date.now();
    const status = inferStatus(name, KNOWN_PARAMETER_KINDS);
    await ctx.db.insert("parameterKinds", {
      name,
      status,
      description: args.description,
      introducedBy: "system",
      createdAt: now,
      updatedAt: now,
    });
    return { status };
  },
});

export const ensureConceptDomain = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    sectorMapping: v.optional(v.string()),
  },
  returns: v.object({
    status: registryStatusValidator,
  }),
  handler: async (ctx, args) => {
    const name = normalizeName(args.name);
    if (!name) return { status: PROVISIONAL_STATUS };

    const existing = await ctx.db
      .query("conceptDomains")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (existing) {
      if (args.sectorMapping && existing.sectorMapping !== args.sectorMapping) {
        await ctx.db.patch(existing._id, {
          sectorMapping: args.sectorMapping,
          updatedAt: Date.now(),
        });
      }
      return { status: existing.status };
    }

    const now = Date.now();
    const status = inferStatus(name, KNOWN_CONCEPT_DOMAINS);
    await ctx.db.insert("conceptDomains", {
      name,
      status,
      description: args.description,
      introducedBy: "system",
      sectorMapping: args.sectorMapping,
      createdAt: now,
      updatedAt: now,
    });
    return { status };
  },
});

export const seedConceptDomains = internalMutation({
  args: {},
  returns: v.object({
    seeded: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let seeded = 0;
    let updated = 0;

    for (const entry of getSeedConceptDomainEntries()) {
      const existing = await ctx.db
        .query("conceptDomains")
        .withIndex("by_name", (q) => q.eq("name", entry.name))
        .first();

      if (!existing) {
        await ctx.db.insert("conceptDomains", {
          name: entry.name,
          status: "known",
          introducedBy: "system",
          sectorMapping: entry.sectorMapping,
          createdAt: now,
          updatedAt: now,
        });
        seeded += 1;
        continue;
      }

      if (
        existing.status !== "known" ||
        existing.sectorMapping !== entry.sectorMapping
      ) {
        await ctx.db.patch(existing._id, {
          status: "known",
          sectorMapping: entry.sectorMapping,
          updatedAt: now,
        });
        updated += 1;
      }
    }

    return { seeded, updated };
  },
});

export const seedMissionConceptDomains = mutation({
  args: {
    entries: v.array(
      v.object({
        name: v.string(),
        description: v.string(),
      }),
    ),
    apply: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    unchanged: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const now = Date.now();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const entry of args.entries) {
      const name = normalizeName(entry.name);
      const existing = await ctx.db
        .query("conceptDomains")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (!existing) {
        created++;
        if (args.apply) {
          await ctx.db.insert("conceptDomains", {
            name,
            status: "known",
            description: entry.description,
            introducedBy: "system",
            createdAt: now,
            updatedAt: now,
          });
        }
        continue;
      }

      if (
        existing.status !== "known" ||
        existing.description !== entry.description ||
        existing.introducedBy !== "system"
      ) {
        updated++;
        if (args.apply) {
          await ctx.db.patch(existing._id, {
            status: "known",
            description: entry.description,
            introducedBy: "system",
            updatedAt: now,
          });
        }
      } else {
        unchanged++;
      }
    }

    return { created, updated, unchanged };
  },
});

export const cleanupProvisionalConceptDomainDuplicates = mutation({
  args: {
    apply: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    duplicateGroups: v.number(),
    deleted: v.number(),
    renamed: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const registry = await ctx.db.query("conceptDomains").collect();
    const groups = new Map<string, Doc<"conceptDomains">[]>();
    for (const entry of registry) {
      const slug = normalizeConceptDomainSlug(entry.name);
      const entries = groups.get(slug) ?? [];
      entries.push(entry);
      groups.set(slug, entries);
    }

    let duplicateGroups = 0;
    let deleted = 0;
    let renamed = 0;
    for (const [slug, entries] of groups) {
      const provisionals = entries.filter(
        (entry) => entry.status === "provisional",
      );
      if (provisionals.length === 0) continue;
      const established = entries.find(
        (entry) => entry.status === "known" || entry.status === "experimental",
      );
      const keep = established
        ? undefined
        : (provisionals.find((entry) => entry.name === slug) ??
          provisionals.toSorted(
            (a, b) => a._creationTime - b._creationTime,
          )[0]);
      const toDelete = established
        ? provisionals
        : provisionals.filter((entry) => entry._id !== keep?._id);
      const shouldRename = keep !== undefined && keep.name !== slug;
      if (toDelete.length === 0 && !shouldRename) continue;

      duplicateGroups++;
      deleted += toDelete.length;
      if (shouldRename) renamed++;
      if (!args.apply) continue;
      for (const entry of toDelete) {
        await ctx.db.delete("conceptDomains", entry._id);
      }
      if (shouldRename && keep) {
        await ctx.db.patch("conceptDomains", keep._id, {
          name: slug,
          updatedAt: Date.now(),
        });
      }
    }
    return { duplicateGroups, deleted, renamed };
  },
});

export const ensureRelationshipKind = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.object({
    status: registryStatusValidator,
  }),
  handler: async (ctx, args) => {
    const name = normalizeName(args.name);
    if (!name) return { status: PROVISIONAL_STATUS };

    const existing = await ctx.db
      .query("relationshipKinds")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (existing) return { status: existing.status };

    const now = Date.now();
    const status = inferStatus(name, KNOWN_RELATIONSHIP_KINDS);
    await ctx.db.insert("relationshipKinds", {
      name,
      status,
      description: args.description,
      introducedBy: "system",
      createdAt: now,
      updatedAt: now,
    });
    return { status };
  },
});

const decisionResultValidator = v.object({
  entryId: v.string(),
  status: registryStatusValidator,
});

type TerminalDecisionArgs = {
  list: VocabularyList;
  entryId: string;
  note?: string;
  devBypassSecret?: string;
};

async function decideTerminal(
  ctx: MutationCtx,
  args: TerminalDecisionArgs,
  status: "known" | "deprecated",
) {
  const identity = await requireAuth(ctx, args);
  const entry = await resolveRegistryEntry(ctx, args.list, args.entryId);
  requireProvisional(entry);
  const now = Date.now();
  await ctx.db.patch(entry._id, {
    status,
    decidedAt: now,
    decidedBy: decidedBy(identity),
    decisionNote: decisionNote(args.note),
    updatedAt: now,
  });
  return { entryId: String(entry._id), status };
}

export const promoteEntry = mutation({
  args: {
    list: vocabularyListValidator,
    entryId: v.string(),
    note: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: decisionResultValidator,
  handler: (ctx, args) => decideTerminal(ctx, args, "known"),
});

export const rejectEntry = mutation({
  args: {
    list: vocabularyListValidator,
    entryId: v.string(),
    note: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: decisionResultValidator,
  handler: (ctx, args) => decideTerminal(ctx, args, "deprecated"),
});

const mergeResultValidator = v.object({
  sourceEntryId: v.string(),
  targetEntryId: v.string(),
  remapped: v.number(),
  alreadyMerged: v.boolean(),
});

function dedupeDomains(domains: string[]) {
  return Array.from(new Set(domains));
}

export const mergeEntry = mutation({
  args: {
    list: vocabularyListValidator,
    sourceEntryId: v.string(),
    targetEntryId: v.string(),
    note: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: mergeResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    if (args.sourceEntryId === args.targetEntryId) {
      triageError(
        "SAME_VOCABULARY_ENTRY",
        "Merge source and target must be different entries",
      );
    }

    const [source, target] = await Promise.all([
      resolveRegistryEntry(ctx, args.list, args.sourceEntryId),
      resolveRegistryEntry(ctx, args.list, args.targetEntryId),
    ]);
    if (target.status !== "known") {
      triageError(
        "MERGE_TARGET_NOT_KNOWN",
        "Vocabulary merge target must have known status",
      );
    }
    if (
      source.status === "deprecated" &&
      source.mergedInto === String(target._id)
    ) {
      return {
        sourceEntryId: source._id,
        targetEntryId: target._id,
        remapped: 0,
        alreadyMerged: true,
      };
    }
    requireProvisional(source);

    let remapped = 0;
    if (args.list === "conceptDomain") {
      const concepts = await ctx.db
        .query("concepts")
        .withIndex("by_domain", (q) => q.eq("domain", source.name))
        .collect();
      for (const concept of concepts) {
        const domains = concept.domains
          ? dedupeDomains([
              target.name,
              ...concept.domains.map((domain) =>
                domain === source.name ? target.name : domain,
              ),
            ])
          : undefined;
        await ctx.db.patch("concepts", concept._id, {
          domain: target.name,
          domains,
          updatedAt: Date.now(),
        });
      }
      remapped = concepts.length;
      // Secondary-only memberships cannot use by_domain. The registry decision
      // completes here; scripts/merge-vocabulary-references.ts rewrites those
      // arrays later through bounded concept pagination.
    } else if (args.list === "relationshipKind") {
      const edges = await ctx.db
        .query("edges")
        .withIndex("by_relationship", (q) => q.eq("relationship", source.name))
        .take(RELATIONSHIP_INLINE_MERGE_LIMIT + 1);
      if (edges.length > RELATIONSHIP_INLINE_MERGE_LIMIT) {
        triageError(
          "RELATIONSHIP_MERGE_TOO_LARGE",
          `More than ${RELATIONSHIP_INLINE_MERGE_LIMIT} edges reference this relationship; use scripts/merge-vocabulary-references.ts`,
        );
      }
      for (const edge of edges) {
        await ctx.db.patch("edges", edge._id, { relationship: target.name });
      }
      remapped = edges.length;
    }
    // Parameter-kind references live in heavy extraction documents without an
    // index. The registry decision is atomic here; the bounded fallback driver
    // rewrites those references after the source is marked merged.

    const now = Date.now();
    await ctx.db.patch(source._id, {
      status: "deprecated",
      mergedInto: String(target._id),
      decidedAt: now,
      decidedBy: decidedBy(identity),
      decisionNote: decisionNote(args.note),
      updatedAt: now,
    });
    return {
      sourceEntryId: source._id,
      targetEntryId: target._id,
      remapped,
      alreadyMerged: false,
    };
  },
});

export const mergeVocabularyReferenceBatch = mutation({
  args: {
    list: vocabularyListValidator,
    sourceEntryId: v.string(),
    targetEntryId: v.string(),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
    apply: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    sourceName: v.string(),
    targetName: v.string(),
    processed: v.number(),
    remapped: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const [source, target] = await Promise.all([
      resolveRegistryEntry(ctx, args.list, args.sourceEntryId),
      resolveRegistryEntry(ctx, args.list, args.targetEntryId),
    ]);
    const isPendingMerge = source.status === "provisional";
    const isRecordedMerge =
      source.status === "deprecated" &&
      source.mergedInto === String(target._id);
    if (!isPendingMerge && !isRecordedMerge) {
      triageError(
        "INVALID_FALLBACK_MERGE_STATE",
        "Fallback remapping requires a provisional source or its recorded merge",
      );
    }
    if (target.status !== "known") {
      triageError(
        "MERGE_TARGET_NOT_KNOWN",
        "Vocabulary merge target must have known status",
      );
    }
    const batchSize = Math.min(Math.max(args.batchSize ?? 25, 1), 100);

    if (args.list === "conceptDomain") {
      const page = await ctx.db
        .query("concepts")
        .paginate({ cursor: args.cursor, numItems: batchSize });
      let remapped = 0;
      for (const concept of page.page) {
        if (
          concept.domain === source.name ||
          !concept.domains?.includes(source.name)
        ) {
          continue;
        }
        remapped++;
        if (!args.apply) continue;
        await ctx.db.patch("concepts", concept._id, {
          domains: dedupeDomains(
            concept.domains.map((domain) =>
              domain === source.name ? target.name : domain,
            ),
          ),
          updatedAt: Date.now(),
        });
      }
      return {
        sourceName: source.name,
        targetName: target.name,
        processed: page.page.length,
        remapped,
        isDone: page.isDone,
        continueCursor: page.continueCursor,
      };
    }

    if (args.list === "parameterKind") {
      const page = await ctx.db
        .query("extractions")
        .paginate({ cursor: args.cursor, numItems: batchSize });
      let remapped = 0;
      for (const extraction of page.page) {
        if (
          !extraction.compositionParameters.some(
            (parameter) => parameter.kind === source.name,
          )
        ) {
          continue;
        }
        remapped++;
        if (!args.apply) continue;
        await ctx.db.patch("extractions", extraction._id, {
          compositionParameters: extraction.compositionParameters.map(
            (parameter) =>
              parameter.kind === source.name
                ? { ...parameter, kind: target.name }
                : parameter,
          ),
        });
      }
      return {
        sourceName: source.name,
        targetName: target.name,
        processed: page.page.length,
        remapped,
        isDone: page.isDone,
        continueCursor: page.continueCursor,
      };
    }

    if (args.apply) {
      const edges = await ctx.db
        .query("edges")
        .withIndex("by_relationship", (q) => q.eq("relationship", source.name))
        .take(batchSize + 1);
      const batch = edges.slice(0, batchSize);
      for (const edge of batch) {
        await ctx.db.patch("edges", edge._id, { relationship: target.name });
      }
      return {
        sourceName: source.name,
        targetName: target.name,
        processed: batch.length,
        remapped: batch.length,
        isDone: edges.length <= batchSize,
        continueCursor: "",
      };
    }

    const page = await ctx.db
      .query("edges")
      .withIndex("by_relationship", (q) => q.eq("relationship", source.name))
      .paginate({ cursor: args.cursor, numItems: batchSize });
    return {
      sourceName: source.name,
      targetName: target.name,
      processed: page.page.length,
      remapped: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

const triageEntryValidator = v.object({
  _id: v.string(),
  name: v.string(),
  displayLabel: v.optional(v.string()),
  description: v.optional(v.string()),
  notes: v.optional(v.string()),
  createdAt: v.number(),
  mentionCount: v.union(v.number(), v.null()),
  mentionCountCapped: v.boolean(),
});

const knownTargetValidator = v.object({
  _id: v.string(),
  name: v.string(),
});

const triageListValidator = v.object({
  provisional: v.array(triageEntryValidator),
  knownTargets: v.array(knownTargetValidator),
});

type RegistryDoc =
  | Doc<"conceptDomains">
  | Doc<"parameterKinds">
  | Doc<"relationshipKinds">;

function buildTriageEntry(
  entry: RegistryDoc,
  mentionCount: number | null,
  mentionCountCapped = false,
) {
  return {
    _id: String(entry._id),
    name: entry.name,
    displayLabel: entry.displayLabel,
    description: entry.description,
    notes: entry.notes,
    createdAt: entry.createdAt,
    mentionCount,
    mentionCountCapped,
  };
}

function buildKnownTargets<T extends { _id: string; name: string }>(
  entries: T[],
) {
  return entries
    .map((entry) => ({ _id: String(entry._id), name: entry.name }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

export const triageBoard = query({
  args: {},
  returns: v.object({
    conceptDomains: triageListValidator,
    parameterKinds: triageListValidator,
    relationshipKinds: triageListValidator,
  }),
  handler: async (ctx) => {
    const [
      conceptDomains,
      parameterKinds,
      relationshipKinds,
      knownConceptDomains,
      knownParameterKinds,
      knownRelationshipKinds,
    ] = await Promise.all([
      ctx.db
        .query("conceptDomains")
        .withIndex("by_status", (q) => q.eq("status", "provisional"))
        .collect(),
      ctx.db
        .query("parameterKinds")
        .withIndex("by_status", (q) => q.eq("status", "provisional"))
        .collect(),
      ctx.db
        .query("relationshipKinds")
        .withIndex("by_status", (q) => q.eq("status", "provisional"))
        .collect(),
      ctx.db
        .query("conceptDomains")
        .withIndex("by_status", (q) => q.eq("status", "known"))
        .collect(),
      ctx.db
        .query("parameterKinds")
        .withIndex("by_status", (q) => q.eq("status", "known"))
        .collect(),
      ctx.db
        .query("relationshipKinds")
        .withIndex("by_status", (q) => q.eq("status", "known"))
        .collect(),
    ]);

    const [conceptEntries, relationshipEntries] = await Promise.all([
      Promise.all(
        conceptDomains.map(async (entry) => {
          const mentions = await ctx.db
            .query("concepts")
            .withIndex("by_domain", (q) => q.eq("domain", entry.name))
            .take(MENTION_COUNT_CAP + 1);
          return buildTriageEntry(
            entry,
            Math.min(mentions.length, MENTION_COUNT_CAP),
            mentions.length > MENTION_COUNT_CAP,
          );
        }),
      ),
      Promise.all(
        relationshipKinds.map(async (entry) => {
          const mentions = await ctx.db
            .query("edges")
            .withIndex("by_relationship", (q) =>
              q.eq("relationship", entry.name),
            )
            .take(MENTION_COUNT_CAP + 1);
          return buildTriageEntry(
            entry,
            Math.min(mentions.length, MENTION_COUNT_CAP),
            mentions.length > MENTION_COUNT_CAP,
          );
        }),
      ),
    ]);

    return {
      conceptDomains: {
        provisional: conceptEntries.toSorted((a, b) =>
          a.name.localeCompare(b.name),
        ),
        knownTargets: buildKnownTargets(knownConceptDomains),
      },
      parameterKinds: {
        provisional: parameterKinds
          .map((entry) => buildTriageEntry(entry, null))
          .toSorted((a, b) => a.name.localeCompare(b.name)),
        knownTargets: buildKnownTargets(knownParameterKinds),
      },
      relationshipKinds: {
        provisional: relationshipEntries.toSorted((a, b) =>
          a.name.localeCompare(b.name),
        ),
        knownTargets: buildKnownTargets(knownRelationshipKinds),
      },
    };
  },
});

export const reviewSummary = query({
  args: {},
  returns: v.object({
    provisionalParameterKinds: v.array(v.string()),
    provisionalConceptDomains: v.array(v.string()),
    provisionalRelationshipKinds: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const [parameterKinds, conceptDomains, relationshipKinds]: [
      Doc<"parameterKinds">[],
      Doc<"conceptDomains">[],
      Doc<"relationshipKinds">[],
    ] = await Promise.all([
      ctx.db
        .query("parameterKinds")
        .withIndex("by_status", (q) => q.eq("status", "provisional"))
        .collect(),
      ctx.db
        .query("conceptDomains")
        .withIndex("by_status", (q) => q.eq("status", "provisional"))
        .collect(),
      ctx.db
        .query("relationshipKinds")
        .withIndex("by_status", (q) => q.eq("status", "provisional"))
        .collect(),
    ]);

    return {
      provisionalParameterKinds: parameterKinds.map((item) => item.name),
      provisionalConceptDomains: conceptDomains.map((item) => item.name),
      provisionalRelationshipKinds: relationshipKinds.map((item) => item.name),
    };
  },
});
