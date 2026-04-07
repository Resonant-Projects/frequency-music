import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  type DatabaseReader,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { deriveFailureArchiveEntries } from "./failures";
import {
  editorialArtifactExportEntryValidator,
  editorialArtifactReturnValidator,
  editorialLinkedIdsValidator,
  editorialPrimaryRefValidator,
  publicEvidenceCardValidator,
} from "./validators";

export const PUBLIC_EDITORIAL_EXPORT_VERSION = "public_editorial_v1" as const;

const kindValidator = v.union(
  v.literal("experiment_recap"),
  v.literal("what_changed_my_mind"),
  v.literal("campaign_summary"),
  v.literal("thesis_summary"),
);

const evidenceStatusValidator = v.union(
  v.literal("supported"),
  v.literal("mixed"),
  v.literal("speculative"),
);

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("in_review"),
  v.literal("approved"),
  v.literal("published"),
);

const visibilityValidator = v.union(
  v.literal("private"),
  v.literal("followers"),
  v.literal("public"),
);

const publishValidationValidator = v.object({
  canSubmitForReview: v.boolean(),
  canPublish: v.boolean(),
  checks: v.array(
    v.object({
      key: v.string(),
      ok: v.boolean(),
      message: v.string(),
    }),
  ),
});

type PublishValidation = {
  canSubmitForReview: boolean;
  canPublish: boolean;
  checks: Array<{ key: string; ok: boolean; message: string }>;
};

type ArtifactKind = Doc<"editorialArtifacts">["kind"];
type ArtifactEvidenceStatus = Doc<"editorialArtifacts">["evidenceStatus"];
type ArtifactStatus = Doc<"editorialArtifacts">["status"];
type ArtifactPrimaryRef = Doc<"editorialArtifacts">["primaryRef"];
type ArtifactLinkedIds = Doc<"editorialArtifacts">["linkedIds"];
type DraftPayload = {
  title: string;
  dek: string;
  bodyMd: string;
  whyItMattersMd: string;
  uncertaintyMd: string;
  whatChangedMd?: string;
  evidenceStatus: ArtifactEvidenceStatus;
  primaryRef: ArtifactPrimaryRef;
  linkedIds: ArtifactLinkedIds;
  publicEvidenceCards: Array<{
    sourceTitle: string;
    sourceCanonicalUrl?: string;
    summary: string;
    evidenceLevel: "peer_reviewed" | "preprint" | "anecdotal" | "speculative" | "personal";
    truthConfidence?: "low" | "medium" | "high";
    interestLevel?: "low" | "medium" | "high";
  }>;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueDefined<T>(values: Array<T | undefined | null>): T[] {
  return [...new Set(values.filter((value): value is T => value != null))];
}

async function uniqueSlug(
  db: DatabaseReader,
  seed: string,
  excludeId?: Id<"editorialArtifacts">,
): Promise<string> {
  const base = slugify(seed) || "editorial-artifact";
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await db
      .query("editorialArtifacts")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!existing || existing._id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function loadRecipesForHypotheses(
  db: DatabaseReader,
  hypothesisIds: Id<"hypotheses">[],
): Promise<Doc<"recipes">[]> {
  const lists = await Promise.all(
    hypothesisIds.map((hypothesisId) =>
      db
        .query("recipes")
        .withIndex("by_hypothesisId_updatedAt", (q) => q.eq("hypothesisId", hypothesisId))
        .collect(),
    ),
  );
  return lists.flat();
}

async function loadCompositionsForRecipes(
  db: DatabaseReader,
  recipeIds: Id<"recipes">[],
): Promise<Doc<"compositions">[]> {
  const lists = await Promise.all(
    recipeIds.map((recipeId) =>
      db
        .query("compositions")
        .withIndex("by_recipeId_updatedAt", (q) => q.eq("recipeId", recipeId))
        .collect(),
    ),
  );
  return lists.flat();
}

async function loadListeningSessionsForCompositions(
  db: DatabaseReader,
  compositionIds: Id<"compositions">[],
): Promise<Doc<"listeningSessions">[]> {
  const lists = await Promise.all(
    compositionIds.map((compositionId) =>
      db
        .query("listeningSessions")
        .withIndex("by_compositionId_createdAt", (q) => q.eq("compositionId", compositionId))
        .collect(),
    ),
  );
  return lists.flat().toSorted((a, b) => b.createdAt - a.createdAt);
}

async function buildPublicEvidenceCards(
  db: DatabaseReader,
  sourceIds: Id<"sources">[],
): Promise<Doc<"editorialArtifacts">["publicEvidenceCards"]> {
  const uniqueIds = uniqueDefined(sourceIds);
  const cards = await Promise.all(
    uniqueIds.map(async (sourceId) => {
      const source = await db.get("sources", sourceId);
      if (!source || source.visibility !== "public") return null;
      const extraction = await db
        .query("extractions")
        .withIndex("by_sourceId_createdAt", (q) => q.eq("sourceId", source._id))
        .order("desc")
        .first();
      const featuredClaim = extraction?.claims[0];
      return {
        sourceTitle: source.title ?? "Untitled source",
        sourceCanonicalUrl: source.canonicalUrl,
        summary: extraction?.summary ?? featuredClaim?.text ?? "Public evidence summary pending.",
        evidenceLevel: featuredClaim?.evidenceLevel ?? "speculative",
        truthConfidence: featuredClaim?.truthConfidence,
        interestLevel: featuredClaim?.interestLevel,
      };
    }),
  );
  return cards.filter((card): card is NonNullable<typeof card> => card !== null);
}

async function collectSourceIdsForArtifact(
  db: DatabaseReader,
  artifact: Doc<"editorialArtifacts">,
): Promise<Id<"sources">[]> {
  const sourceIds = new Set<Id<"sources">>();

  if (artifact.primaryRef.type === "weeklyBrief") {
    const brief = await db.get("weeklyBriefs", artifact.primaryRef.id);
    for (const sourceId of brief?.sourceIds ?? []) {
      sourceIds.add(sourceId);
    }
  }

  const hypotheses = await Promise.all(
    artifact.linkedIds.hypothesisIds.map((id) => db.get("hypotheses", id)),
  );
  for (const hypothesis of hypotheses) {
    for (const sourceId of hypothesis?.sourceIds ?? []) {
      sourceIds.add(sourceId);
    }
  }

  return [...sourceIds];
}

async function findPrivacyViolations(
  db: DatabaseReader,
  artifact: Doc<"editorialArtifacts">,
): Promise<{
  privateSourceMentions: string[];
  privateExtractionMentions: string[];
}> {
  const sourceIds = await collectSourceIdsForArtifact(db, artifact);
  const text = [
    artifact.title,
    artifact.dek,
    artifact.bodyMd,
    artifact.whyItMattersMd,
    artifact.uncertaintyMd,
    artifact.whatChangedMd ?? "",
  ]
    .join("\n")
    .toLowerCase();

  const privateSourceMentions: string[] = [];
  const privateExtractionMentions: string[] = [];

  for (const sourceId of sourceIds) {
    const source = await db.get("sources", sourceId);
    if (!source || source.visibility === "public") continue;
    const title = source.title?.trim();
    if (title && text.includes(title.toLowerCase())) {
      privateSourceMentions.push(title);
    }
    const extraction = await db
      .query("extractions")
      .withIndex("by_sourceId_createdAt", (q) => q.eq("sourceId", source._id))
      .order("desc")
      .first();
    const summary = extraction?.summary?.trim();
    if (summary && text.includes(summary.toLowerCase())) {
      privateExtractionMentions.push(summary);
    }
  }

  return { privateSourceMentions, privateExtractionMentions };
}

export async function validateArtifactForPublish(
  db: DatabaseReader,
  artifact: Doc<"editorialArtifacts">,
): Promise<PublishValidation> {
  const bodyOk = artifact.bodyMd.trim().length > 0;
  const whyOk = artifact.whyItMattersMd.trim().length > 0;
  const uncertaintyOk = artifact.uncertaintyMd.trim().length > 0;
  const visibilityOk = artifact.visibility === "public";
  const statusOk = artifact.status === "approved" || artifact.status === "published";
  const privacy = await findPrivacyViolations(db, artifact);
  const noPrivateSourceMentions = privacy.privateSourceMentions.length === 0;
  const noPrivateExtractionMentions = privacy.privateExtractionMentions.length === 0;

  const checks = [
    {
      key: "body",
      ok: bodyOk,
      message: bodyOk ? "Narrative body is present." : "Narrative body is required.",
    },
    {
      key: "why",
      ok: whyOk,
      message: whyOk ? "Why-it-matters section is present." : "Why-it-matters section is required.",
    },
    {
      key: "uncertainty",
      ok: uncertaintyOk,
      message: uncertaintyOk
        ? "Uncertainty language is present."
        : "Uncertainty section is required.",
    },
    {
      key: "visibility",
      ok: visibilityOk,
      message: visibilityOk
        ? "Artifact is marked public."
        : "Artifact visibility must be public before publish/export.",
    },
    {
      key: "approval",
      ok: statusOk,
      message: statusOk
        ? "Artifact is approved for publishing."
        : "Artifact must be approved before publishing.",
    },
    {
      key: "privateSources",
      ok: noPrivateSourceMentions,
      message: noPrivateSourceMentions
        ? "No private source titles are referenced directly."
        : `Private source titles are referenced directly: ${privacy.privateSourceMentions.join(", ")}`,
    },
    {
      key: "privateExtractions",
      ok: noPrivateExtractionMentions,
      message: noPrivateExtractionMentions
        ? "No private extraction summaries are copied directly."
        : "Private extraction summaries are referenced directly in the artifact body.",
    },
  ];

  return {
    canSubmitForReview: bodyOk && whyOk && uncertaintyOk,
    canPublish: checks.every((check) => check.ok),
    checks,
  };
}

function renderList(items: string[], empty = "None yet."): string {
  if (items.length === 0) return `- ${empty}`;
  return items.map((item) => `- ${item}`).join("\n");
}

export async function buildWeeklyBriefDraft(
  db: DatabaseReader,
  brief: Doc<"weeklyBriefs">,
): Promise<DraftPayload> {
  const hypotheses = await Promise.all(
    brief.recommendedHypothesisIds.map((id) => db.get("hypotheses", id)),
  );
  const failures = await deriveFailureArchiveEntries(db as any);
  const referencedFailures = failures.filter((failure) =>
    (brief.referencedFailureKeys ?? []).includes(failure.key),
  );
  const publicEvidenceCards = await buildPublicEvidenceCards(db, brief.sourceIds);

  return {
    title: `Experiment Recap: Week of ${brief.weekOf}`,
    dek: `A public-facing recap of the research, studio steering, and reversals that shaped the week of ${brief.weekOf}.`,
    bodyMd: [
      "## What We Tried",
      renderList(
        (brief.recommendedActions ?? []).map(
          (action) =>
            `[${action.durationBucket}] ${action.kind} on ${action.targetType} ${action.targetId.slice(-6)}: ${action.reason}`,
        ),
        "No deterministic action list was stored on this brief.",
      ),
      "",
      "## What Changed",
      renderList(
        referencedFailures.map((failure) => `${failure.title}: ${failure.explanation}`),
        "No major reversal was linked into this weekly recap.",
      ),
      "",
      "## What Still Feels Open",
      renderList(brief.todo ?? [], "Open questions still need to be written into this recap."),
    ].join("\n"),
    whyItMattersMd: [
      "The musical stake of this week was to turn live inquiry into studio action without flattening uncertainty.",
      "",
      renderList(
        hypotheses
          .filter((row): row is NonNullable<typeof row> => row !== null)
          .map(
            (row) =>
              `${row.title}: ${row.whyThisMatters ?? "Why-this-matters still needs cleanup."}`,
          ),
      ),
    ].join("\n"),
    uncertaintyMd:
      "This recap should state clearly which parts were evidence-backed, which remained provisional, and where listening or compositional follow-through is still thin.",
    evidenceStatus: publicEvidenceCards.length > 0 ? "mixed" : "speculative",
    primaryRef: {
      type: "weeklyBrief",
      id: brief._id,
    },
    linkedIds: {
      thesisIds: uniqueDefined(brief.activeThesisIds ?? []),
      hypothesisIds: uniqueDefined(brief.recommendedHypothesisIds),
      recipeIds: uniqueDefined(brief.recommendedRecipeIds),
      compositionIds: [],
      listeningSessionIds: [],
      failureKeys: uniqueDefined(brief.referencedFailureKeys ?? []),
    },
    publicEvidenceCards,
  };
}

function evidenceCardsEqual(
  left: Doc<"editorialArtifacts">["publicEvidenceCards"],
  right: Doc<"editorialArtifacts">["publicEvidenceCards"],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function linkedIdsEqual(left: ArtifactLinkedIds, right: ArtifactLinkedIds): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function primaryRefEqual(left: ArtifactPrimaryRef, right: ArtifactPrimaryRef): boolean {
  return left.type === right.type && left.id === right.id;
}

export async function buildCampaignDraft(
  db: DatabaseReader,
  campaign: Doc<"campaigns">,
): Promise<DraftPayload> {
  const theses = (await Promise.all(campaign.thesisIds.map((id) => db.get("theses", id)))).filter(
    (row): row is Doc<"theses"> => row !== null,
  );
  const hypotheses = (
    await Promise.all(
      theses.map((thesis) =>
        db
          .query("hypotheses")
          .withIndex("by_thesisId_updatedAt", (q) => q.eq("thesisId", thesis._id))
          .collect(),
      ),
    )
  ).flat();
  const recipes = await loadRecipesForHypotheses(
    db,
    hypotheses.map((row) => row._id),
  );
  const compositions = await loadCompositionsForRecipes(
    db,
    recipes.map((row) => row._id),
  );
  const listeningSessions = await loadListeningSessionsForCompositions(
    db,
    compositions.map((row) => row._id),
  );
  const failures = await deriveFailureArchiveEntries(db as any);
  const relevantFailures = failures.filter((failure) =>
    failure.supportingIds.thesisIds.some((id) => campaign.thesisIds.includes(id)),
  );
  const sourceIds = hypotheses.flatMap((hypothesis) => hypothesis.sourceIds);
  const publicEvidenceCards = await buildPublicEvidenceCards(db, sourceIds);

  return {
    title: `Campaign Summary: ${campaign.title}`,
    dek: campaign.question,
    bodyMd: [
      "## What We Tried",
      renderList(
        recipes.map(
          (recipe: Doc<"recipes">) => `${recipe.title}: ${recipe.whyThisMatters ?? recipe.bodyMd}`,
        ),
        "No recipes have been linked to this campaign yet.",
      ),
      "",
      "## What Changed",
      renderList(
        relevantFailures.slice(0, 6).map((failure) => `${failure.title}: ${failure.explanation}`),
        "No contradictions or low-yield turns have been summarized yet.",
      ),
      "",
      "## What Still Feels Open",
      renderList(
        hypotheses
          .filter((hypothesis) => hypothesis.status !== "retired")
          .map((hypothesis) => hypothesis.question),
        "No active hypothesis questions remain attached to this campaign.",
      ),
    ].join("\n"),
    whyItMattersMd: [
      `This campaign asks: ${campaign.question}`,
      "",
      renderList(
        theses.map((thesis) => `${thesis.title}: ${thesis.statement}`),
        "This campaign has no attached theses yet.",
      ),
    ].join("\n"),
    uncertaintyMd:
      "This summary should distinguish between campaign momentum, actual evidence, and the places where the work is still exploratory or musically unresolved.",
    evidenceStatus:
      relevantFailures.length > 0 || publicEvidenceCards.length > 0 ? "mixed" : "speculative",
    primaryRef: {
      type: "campaign",
      id: campaign._id,
    },
    linkedIds: {
      thesisIds: uniqueDefined(theses.map((row) => row._id)),
      hypothesisIds: uniqueDefined(hypotheses.map((row) => row._id)),
      recipeIds: uniqueDefined(recipes.map((row) => row._id)),
      compositionIds: uniqueDefined(compositions.map((row) => row._id)),
      listeningSessionIds: uniqueDefined(listeningSessions.map((row) => row._id)),
      failureKeys: uniqueDefined(relevantFailures.map((row) => row.key)),
    },
    publicEvidenceCards,
  };
}

export async function buildThesisDraft(
  db: DatabaseReader,
  thesis: Doc<"theses">,
  args?: {
    kind?: "thesis_summary" | "what_changed_my_mind";
    hypothesisId?: Id<"hypotheses">;
  },
): Promise<DraftPayload> {
  const hypotheses = await db
    .query("hypotheses")
    .withIndex("by_thesisId_updatedAt", (q) => q.eq("thesisId", thesis._id))
    .collect();
  const recipes = await loadRecipesForHypotheses(
    db,
    hypotheses.map((row) => row._id),
  );
  const compositions = await loadCompositionsForRecipes(
    db,
    recipes.map((row) => row._id),
  );
  const listeningSessions = await loadListeningSessionsForCompositions(
    db,
    compositions.map((row) => row._id),
  );
  const failures = await deriveFailureArchiveEntries(db as any);
  const relevantFailures = failures.filter((failure) =>
    failure.supportingIds.thesisIds.includes(thesis._id),
  );
  const contradictedHypothesis =
    args?.hypothesisId !== undefined
      ? hypotheses.find((hypothesis: Doc<"hypotheses">) => hypothesis._id === args.hypothesisId)
      : hypotheses.find(
          (hypothesis: Doc<"hypotheses">) => hypothesis.resolution === "contradicted",
        );
  const sourceIds = hypotheses.flatMap((hypothesis) => hypothesis.sourceIds);
  const publicEvidenceCards = await buildPublicEvidenceCards(db, sourceIds);
  const kind = args?.kind ?? "thesis_summary";
  const isChangedMind = kind === "what_changed_my_mind" && contradictedHypothesis;
  if (kind === "what_changed_my_mind" && !contradictedHypothesis) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message:
        "A contradicted or explicitly selected hypothesis is required for what_changed_my_mind",
    });
  }

  return {
    title: isChangedMind
      ? `What Changed My Mind: ${contradictedHypothesis.title}`
      : `Thesis Summary: ${thesis.title}`,
    dek: isChangedMind ? contradictedHypothesis.question : thesis.statement,
    bodyMd: [
      "## What We Tried",
      renderList(
        hypotheses.map(
          (hypothesis: Doc<"hypotheses">) => `${hypothesis.title}: ${hypothesis.hypothesis}`,
        ),
        "No hypotheses are attached to this thesis yet.",
      ),
      "",
      "## What Changed",
      renderList(
        isChangedMind
          ? relevantFailures
              .filter((failure) => failure.hypothesisId === contradictedHypothesis?._id)
              .map((failure) => `${failure.title}: ${failure.explanation}`)
          : relevantFailures.map((failure) => `${failure.title}: ${failure.explanation}`),
        "No clear reversal has been documented yet.",
      ),
      "",
      "## What Still Feels Open",
      renderList(
        hypotheses
          .filter((hypothesis: Doc<"hypotheses">) => hypothesis.status !== "retired")
          .map((hypothesis: Doc<"hypotheses">) => hypothesis.question),
        "No open hypothesis questions are attached to this thesis.",
      ),
    ].join("\n"),
    whyItMattersMd: isChangedMind
      ? (contradictedHypothesis.whyThisMatters ??
        "Why-this-matters still needs cleanup for this contradicted hypothesis.")
      : [
          thesis.statement,
          "",
          renderList(
            hypotheses.map(
              (hypothesis: Doc<"hypotheses">) =>
                `${hypothesis.title}: ${hypothesis.whyThisMatters ?? "Why-this-matters still needs cleanup."}`,
            ),
          ),
        ].join("\n"),
    uncertaintyMd:
      "This piece should identify which claims survived repeated making and listening, which ones reversed, and which ones are still artistically promising but evidentially thin.",
    whatChangedMd: isChangedMind
      ? `The main reversal centered on **${contradictedHypothesis.title}** and should be rewritten here in public-safe language.`
      : undefined,
    evidenceStatus:
      relevantFailures.length > 0 && publicEvidenceCards.length > 0
        ? "mixed"
        : publicEvidenceCards.length > 0
          ? "supported"
          : "speculative",
    primaryRef: {
      type: isChangedMind ? "hypothesis" : "thesis",
      id: isChangedMind ? contradictedHypothesis._id : thesis._id,
    },
    linkedIds: {
      thesisIds: [thesis._id],
      hypothesisIds: uniqueDefined(hypotheses.map((row) => row._id)),
      recipeIds: uniqueDefined(recipes.map((row) => row._id)),
      compositionIds: uniqueDefined(compositions.map((row) => row._id)),
      listeningSessionIds: uniqueDefined(listeningSessions.map((row) => row._id)),
      failureKeys: uniqueDefined(relevantFailures.map((row) => row.key)),
    },
    publicEvidenceCards,
  };
}

async function resolveExportContext(
  db: DatabaseReader,
  artifact: Doc<"editorialArtifacts">,
): Promise<{ campaignSlug?: string; thesisSlugs: string[] }> {
  let campaignSlug: string | undefined;
  if (artifact.primaryRef.type === "campaign") {
    const campaign = await db.get("campaigns", artifact.primaryRef.id);
    campaignSlug = campaign ? slugify(campaign.title) : undefined;
  } else if (artifact.primaryRef.type === "weeklyBrief") {
    const brief = await db.get("weeklyBriefs", artifact.primaryRef.id);
    if (brief?.campaignId) {
      const campaign = await db.get("campaigns", brief.campaignId);
      campaignSlug = campaign ? slugify(campaign.title) : undefined;
    }
  }

  const theses = await Promise.all(artifact.linkedIds.thesisIds.map((id) => db.get("theses", id)));

  return {
    campaignSlug,
    thesisSlugs: uniqueDefined(
      theses.map((row: Doc<"theses"> | null) => (row ? slugify(row.title) : undefined)),
    ),
  };
}

export function buildExportEntry(
  artifact: Doc<"editorialArtifacts">,
  appBaseUrl: string,
  linkedMeta?: { campaignSlug?: string; thesisSlugs?: string[] },
): {
  path: string;
  markdown: string;
  manifestEntry: {
    slug: string;
    path: string;
    title: string;
    kind: Doc<"editorialArtifacts">["kind"];
    publishedAt: number;
    evidenceStatus: Doc<"editorialArtifacts">["evidenceStatus"];
  };
} {
  const path = `${artifact.slug}.md`;
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(artifact.title)}`,
    `slug: ${JSON.stringify(artifact.slug)}`,
    `kind: ${JSON.stringify(artifact.kind)}`,
    `publishedAt: ${JSON.stringify(
      new Date(artifact.publishedAt ?? artifact.updatedAt).toISOString(),
    )}`,
    `dek: ${JSON.stringify(artifact.dek)}`,
    `evidenceStatus: ${JSON.stringify(artifact.evidenceStatus)}`,
    `uncertaintySummary: ${JSON.stringify(artifact.uncertaintyMd)}`,
    `whyItMatters: ${JSON.stringify(artifact.whyItMattersMd)}`,
    ...(linkedMeta?.campaignSlug
      ? [`campaignSlug: ${JSON.stringify(linkedMeta.campaignSlug)}`]
      : []),
    ...(linkedMeta?.thesisSlugs?.length
      ? [`thesisSlugs: ${JSON.stringify(linkedMeta.thesisSlugs)}`]
      : []),
    `canonicalAppUrl: ${JSON.stringify(
      `${appBaseUrl.replace(/\/$/, "")}/editorial/${artifact._id}`,
    )}`,
    "---",
    "",
  ].join("\n");
  const markdown = [
    frontmatter,
    artifact.bodyMd,
    "",
    "## Why It Matters",
    artifact.whyItMattersMd,
    "",
    "## Uncertainty",
    artifact.uncertaintyMd,
    artifact.whatChangedMd ? `\n## What Changed\n${artifact.whatChangedMd}\n` : "",
  ].join("\n");

  return {
    path,
    markdown,
    manifestEntry: {
      slug: artifact.slug,
      path,
      title: artifact.title,
      kind: artifact.kind,
      publishedAt: artifact.publishedAt ?? artifact.updatedAt,
      evidenceStatus: artifact.evidenceStatus,
    },
  };
}

export const list = query({
  args: {
    kind: v.optional(kindValidator),
    status: v.optional(statusValidator),
    limit: v.optional(v.number()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.array(editorialArtifactReturnValidator),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    let rows: Doc<"editorialArtifacts">[];
    if (args.kind !== undefined) {
      const kind = args.kind;
      rows = await ctx.db
        .query("editorialArtifacts")
        .withIndex("by_kind_updatedAt", (q) => q.eq("kind", kind))
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.status !== undefined) {
      const status = args.status;
      rows = await ctx.db
        .query("editorialArtifacts")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", status))
        .order("desc")
        .take(args.limit ?? 50);
    } else {
      rows = await ctx.db
        .query("editorialArtifacts")
        .order("desc")
        .take(args.limit ?? 50);
    }
    return rows;
  },
});

export const get = query({
  args: {
    id: v.id("editorialArtifacts"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      artifact: editorialArtifactReturnValidator,
      validation: publishValidationValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const artifact = await ctx.db.get("editorialArtifacts", args.id);
    if (!artifact) return null;
    const validation = await validateArtifactForPublish(ctx.db, artifact);
    return { artifact, validation };
  },
});

async function insertDraftArtifact(
  ctx: { db: any },
  identity: { subject: string },
  kind: ArtifactKind,
  payload: DraftPayload,
): Promise<Id<"editorialArtifacts">> {
  const now = Date.now();
  const slug = await uniqueSlug(ctx.db, payload.title);
  return await ctx.db.insert("editorialArtifacts", {
    kind,
    slug,
    title: payload.title,
    dek: payload.dek,
    bodyMd: payload.bodyMd,
    whyItMattersMd: payload.whyItMattersMd,
    uncertaintyMd: payload.uncertaintyMd,
    whatChangedMd: payload.whatChangedMd,
    evidenceStatus: payload.evidenceStatus,
    status: "draft",
    visibility: "private",
    primaryRef: payload.primaryRef,
    linkedIds: payload.linkedIds,
    publicEvidenceCards: payload.publicEvidenceCards,
    createdBy: identity.subject === "system" ? "system" : (identity.subject as Id<"users">),
    createdAt: now,
    updatedAt: now,
  });
}

export const createDraftFromWeeklyBrief = mutation({
  args: {
    weeklyBriefId: v.id("weeklyBriefs"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("editorialArtifacts"),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    const brief = await ctx.db.get("weeklyBriefs", args.weeklyBriefId);
    if (!brief) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Weekly brief not found",
      });
    }
    const payload = await buildWeeklyBriefDraft(ctx.db, brief);
    return await insertDraftArtifact(ctx, identity, "experiment_recap", payload);
  },
});

export const createDraftFromCampaign = mutation({
  args: {
    campaignId: v.id("campaigns"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("editorialArtifacts"),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    const campaign = await ctx.db.get("campaigns", args.campaignId);
    if (!campaign) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Campaign not found",
      });
    }
    const payload = await buildCampaignDraft(ctx.db, campaign);
    return await insertDraftArtifact(ctx, identity, "campaign_summary", payload);
  },
});

export const createDraftFromThesis = mutation({
  args: {
    thesisId: v.id("theses"),
    kind: v.optional(v.union(v.literal("thesis_summary"), v.literal("what_changed_my_mind"))),
    hypothesisId: v.optional(v.id("hypotheses")),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("editorialArtifacts"),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    const thesis = await ctx.db.get("theses", args.thesisId);
    if (!thesis) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Thesis not found",
      });
    }
    const payload = await buildThesisDraft(ctx.db, thesis, {
      kind: args.kind,
      hypothesisId: args.hypothesisId,
    });
    return await insertDraftArtifact(ctx, identity, args.kind ?? "thesis_summary", payload);
  },
});

export const update = mutation({
  args: {
    id: v.id("editorialArtifacts"),
    kind: v.optional(kindValidator),
    title: v.optional(v.string()),
    dek: v.optional(v.string()),
    slug: v.optional(v.string()),
    bodyMd: v.optional(v.string()),
    whyItMattersMd: v.optional(v.string()),
    uncertaintyMd: v.optional(v.string()),
    whatChangedMd: v.optional(v.union(v.string(), v.null())),
    evidenceStatus: v.optional(evidenceStatusValidator),
    visibility: v.optional(visibilityValidator),
    publicEvidenceCards: v.optional(v.array(publicEvidenceCardValidator)),
    linkedIds: v.optional(editorialLinkedIdsValidator),
    primaryRef: v.optional(editorialPrimaryRefValidator),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const artifact = await ctx.db.get("editorialArtifacts", args.id);
    if (!artifact) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Editorial artifact not found",
      });
    }
    const slug = args.slug !== undefined ? await uniqueSlug(ctx.db, args.slug, args.id) : undefined;
    const normalizedWhatChanged =
      args.whatChangedMd !== undefined ? (args.whatChangedMd ?? undefined) : undefined;
    const reviewSensitiveChanged =
      (args.kind !== undefined && args.kind !== artifact.kind) ||
      (args.title !== undefined && args.title.trim() !== artifact.title) ||
      (args.dek !== undefined && args.dek.trim() !== artifact.dek) ||
      (slug !== undefined && slug !== artifact.slug) ||
      (args.bodyMd !== undefined && args.bodyMd !== artifact.bodyMd) ||
      (args.whyItMattersMd !== undefined && args.whyItMattersMd !== artifact.whyItMattersMd) ||
      (args.uncertaintyMd !== undefined && args.uncertaintyMd !== artifact.uncertaintyMd) ||
      (args.whatChangedMd !== undefined && normalizedWhatChanged !== artifact.whatChangedMd) ||
      (args.evidenceStatus !== undefined && args.evidenceStatus !== artifact.evidenceStatus) ||
      (args.visibility !== undefined && args.visibility !== artifact.visibility) ||
      (args.publicEvidenceCards !== undefined &&
        !evidenceCardsEqual(args.publicEvidenceCards, artifact.publicEvidenceCards)) ||
      (args.linkedIds !== undefined && !linkedIdsEqual(args.linkedIds, artifact.linkedIds)) ||
      (args.primaryRef !== undefined && !primaryRefEqual(args.primaryRef, artifact.primaryRef));
    await ctx.db.patch(args.id, {
      ...(args.kind !== undefined ? { kind: args.kind } : {}),
      ...(args.title !== undefined ? { title: args.title.trim() } : {}),
      ...(args.dek !== undefined ? { dek: args.dek.trim() } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(args.bodyMd !== undefined ? { bodyMd: args.bodyMd } : {}),
      ...(args.whyItMattersMd !== undefined ? { whyItMattersMd: args.whyItMattersMd } : {}),
      ...(args.uncertaintyMd !== undefined ? { uncertaintyMd: args.uncertaintyMd } : {}),
      ...(args.whatChangedMd !== undefined ? { whatChangedMd: normalizedWhatChanged } : {}),
      ...(args.evidenceStatus !== undefined ? { evidenceStatus: args.evidenceStatus } : {}),
      ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
      ...(args.publicEvidenceCards !== undefined
        ? { publicEvidenceCards: args.publicEvidenceCards }
        : {}),
      ...(args.linkedIds !== undefined ? { linkedIds: args.linkedIds } : {}),
      ...(args.primaryRef !== undefined ? { primaryRef: args.primaryRef } : {}),
      ...(reviewSensitiveChanged && artifact.status !== "draft"
        ? {
            status: "draft" as ArtifactStatus,
            ...(artifact.status === "published" ? { publishedAt: undefined } : {}),
          }
        : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const submitForReview = mutation({
  args: {
    id: v.id("editorialArtifacts"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    status: statusValidator,
    validation: publishValidationValidator,
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const artifact = await ctx.db.get("editorialArtifacts", args.id);
    if (!artifact) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Editorial artifact not found",
      });
    }
    if (artifact.status !== "draft") {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Only draft artifacts can be submitted for review",
      });
    }
    const validation = await validateArtifactForPublish(ctx.db, artifact);
    if (!validation.canSubmitForReview) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Artifact is missing required narrative sections for review",
      });
    }
    await ctx.db.patch(args.id, {
      status: "in_review",
      updatedAt: Date.now(),
    });
    return { status: "in_review" as ArtifactStatus, validation };
  },
});

export const approve = mutation({
  args: {
    id: v.id("editorialArtifacts"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    status: statusValidator,
    validation: publishValidationValidator,
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const artifact = await ctx.db.get("editorialArtifacts", args.id);
    if (!artifact) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Editorial artifact not found",
      });
    }
    if (artifact.status !== "in_review") {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Only in-review artifacts can be approved",
      });
    }
    const validation = await validateArtifactForPublish(ctx.db, artifact);
    await ctx.db.patch(args.id, {
      status: "approved",
      updatedAt: Date.now(),
    });
    return { status: "approved" as ArtifactStatus, validation };
  },
});

export const publish = mutation({
  args: {
    id: v.id("editorialArtifacts"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    status: statusValidator,
    validation: publishValidationValidator,
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const artifact = await ctx.db.get("editorialArtifacts", args.id);
    if (!artifact) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Editorial artifact not found",
      });
    }
    if (artifact.status !== "approved") {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Only approved artifacts can be published",
      });
    }
    const validation = await validateArtifactForPublish(ctx.db, artifact);
    if (!validation.canPublish) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Artifact failed the pre-publish checklist",
      });
    }
    await ctx.db.patch(args.id, {
      status: "published",
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { status: "published" as ArtifactStatus, validation };
  },
});

export const listPublicExport = query({
  args: {},
  returns: v.object({
    version: v.literal(PUBLIC_EDITORIAL_EXPORT_VERSION),
    items: v.array(editorialArtifactExportEntryValidator),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("editorialArtifacts")
      .withIndex("by_visibility_updatedAt", (q) => q.eq("visibility", "public"))
      .order("desc")
      .collect();
    const items = rows
      .filter((row) => row.status === "published")
      .map((row) => ({
        slug: row.slug,
        path: row.astro?.exportPath ?? `${row.slug}.md`,
        title: row.title,
        kind: row.kind,
        publishedAt: row.publishedAt ?? row.updatedAt,
        evidenceStatus: row.evidenceStatus,
      }));
    return {
      version: PUBLIC_EDITORIAL_EXPORT_VERSION,
      items,
    };
  },
});

async function loadPublishedExportBundle(db: DatabaseReader) {
  const artifacts = await db
    .query("editorialArtifacts")
    .withIndex("by_visibility_updatedAt", (q) => q.eq("visibility", "public"))
    .order("desc")
    .collect();
  const publishedArtifacts = artifacts.filter((artifact) => artifact.status === "published");
  return await Promise.all(
    publishedArtifacts.map(async (artifact) => ({
      artifact,
      validation: await validateArtifactForPublish(db, artifact),
      ...(await resolveExportContext(db, artifact)),
    })),
  );
}

async function patchAstroExportMetadata(
  ctx: {
    db: {
      get: (id: Id<"editorialArtifacts">) => Promise<Doc<"editorialArtifacts"> | null>;
      patch: (
        id: Id<"editorialArtifacts">,
        fields: Partial<Doc<"editorialArtifacts">>,
      ) => Promise<void>;
    };
  },
  args: {
    id: Id<"editorialArtifacts">;
    exportPath: string;
    exportSha: string;
    exportedAt: number;
  },
) {
  const artifact = await ctx.db.get(args.id);
  if (!artifact) return null;
  await ctx.db.patch(args.id, {
    astro: {
      exportPath: args.exportPath,
      exportSha: args.exportSha,
      exportedAt: args.exportedAt,
    },
  });
  return null;
}

const exportBundleReturnValidator = v.array(
  v.object({
    artifact: editorialArtifactReturnValidator,
    validation: publishValidationValidator,
    campaignSlug: v.optional(v.string()),
    thesisSlugs: v.array(v.string()),
  }),
);

export const getPublicExportBundle = query({
  args: { devBypassSecret: v.optional(v.string()) },
  returns: exportBundleReturnValidator,
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await loadPublishedExportBundle(ctx.db);
  },
});

export const setAstroExportMetadata = mutation({
  args: {
    id: v.id("editorialArtifacts"),
    exportPath: v.string(),
    exportSha: v.string(),
    exportedAt: v.number(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await patchAstroExportMetadata(ctx, args);
  },
});

export const setAstroExportMetadataInternal = internalMutation({
  args: {
    id: v.id("editorialArtifacts"),
    exportPath: v.string(),
    exportSha: v.string(),
    exportedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await patchAstroExportMetadata(ctx, args);
  },
});

export const getExportBundleInternal = internalQuery({
  args: {},
  returns: exportBundleReturnValidator,
  handler: async (ctx) => {
    return await loadPublishedExportBundle(ctx.db);
  },
});

export const exportForAstro = action({
  args: {
    outputDir: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    version: v.literal(PUBLIC_EDITORIAL_EXPORT_VERSION),
    outputDir: v.string(),
    exportedCount: v.number(),
    manifestPath: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await ctx.runAction(internal.editorialExports.exportForAstroInternal, {
      outputDir: args.outputDir,
    });
  },
});
