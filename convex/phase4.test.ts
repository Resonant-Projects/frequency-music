import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  buildExportEntry,
  buildThesisDraft,
  buildWeeklyBriefDraft,
  validateArtifactForPublish,
} from "./editorialArtifacts";
import { assertWhyThisMatters } from "./hypotheses";
import { loadExtractionsForHypothesisSourceIds } from "./compositions";
import { makeDb } from "./testHelpers";

describe("phase 1 hardening", () => {
  test("rejects blank whyThisMatters for new hypotheses", () => {
    expect(() => assertWhyThisMatters("   ")).toThrow(ConvexError);
    expect(assertWhyThisMatters("Musically consequential.")).toBe(
      "Musically consequential.",
    );
  });
});

describe("phase 2 lineage", () => {
  test("loads extraction nodes for the hypothesis source chain", async () => {
    const db = makeDb({
      campaigns: [],
      theses: [],
      hypotheses: [],
      recipes: [],
      compositions: [],
      listeningSessions: [],
      sources: [],
      weeklyBriefs: [],
      editorialArtifacts: [],
      extractions: [
        {
          _id: "extract-older",
          sourceId: "source-a",
          summary: "older",
          createdAt: 10,
          claims: [],
          compositionParameters: [],
          topics: [],
        },
        {
          _id: "extract-newer",
          sourceId: "source-a",
          summary: "newer",
          createdAt: 20,
          claims: [],
          compositionParameters: [],
          topics: [],
        },
        {
          _id: "extract-b",
          sourceId: "source-b",
          summary: "second source",
          createdAt: 15,
          claims: [],
          compositionParameters: [],
          topics: [],
        },
      ],
    });

    const result = await loadExtractionsForHypothesisSourceIds(db as any, [
      "source-a" as any,
      "source-b" as any,
    ]);

    expect(result.map((row) => row._id)).toEqual([
      "extract-newer",
      "extract-b",
      "extract-older",
    ]);
  });
});

describe("phase 4 editorial artifacts", () => {
  test("blocks publish when private source material is referenced directly", async () => {
    const privateTitle = "Private Notebook";
    const privateSummary = "verbatim private extraction summary";
    const artifact = {
      _id: "artifact-1",
      _creationTime: 1,
      kind: "experiment_recap",
      slug: "artifact-1",
      title: `Recap mentioning ${privateTitle}`,
      dek: "Draft",
      bodyMd: `We quoted ${privateSummary} in the public draft.`,
      whyItMattersMd: "Why this matters.",
      uncertaintyMd: "Still uncertain.",
      evidenceStatus: "mixed",
      status: "approved",
      visibility: "public",
      primaryRef: { type: "hypothesis", id: "hyp-1" },
      linkedIds: {
        thesisIds: [],
        hypothesisIds: ["hyp-1"],
        recipeIds: [],
        compositionIds: [],
        listeningSessionIds: [],
        failureKeys: [],
      },
      publicEvidenceCards: [],
      createdBy: "system",
      createdAt: 1,
      updatedAt: 2,
      publishedAt: 3,
    } as Doc<"editorialArtifacts">;

    const db = makeDb({
      campaigns: [],
      theses: [],
      hypotheses: [
        {
          _id: "hyp-1",
          title: "Hypothesis",
          question: "Q",
          hypothesis: "H",
          whyThisMatters: "W",
          rationaleMd: "R",
          sourceIds: ["source-1"],
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      recipes: [],
      compositions: [],
      listeningSessions: [],
      weeklyBriefs: [],
      editorialArtifacts: [artifact],
      sources: [
        {
          _id: "source-1",
          title: privateTitle,
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      extractions: [
        {
          _id: "extract-1",
          sourceId: "source-1",
          summary: privateSummary,
          createdAt: 1,
          claims: [],
          compositionParameters: [],
          topics: [],
        },
      ],
    });

    const validation = await validateArtifactForPublish(db as any, artifact);

    expect(validation.canPublish).toBe(false);
    expect(
      validation.checks.find((check) => check.key === "privateSources")?.ok,
    ).toBe(false);
    expect(
      validation.checks.find((check) => check.key === "privateExtractions")?.ok,
    ).toBe(false);
  });

  test("exports deterministic markdown with optional campaign and thesis slugs", async () => {
    const artifact = {
      _id: "artifact-2",
      _creationTime: 1,
      kind: "campaign_summary",
      slug: "campaign-summary",
      title: "Campaign Summary",
      dek: "Dek",
      bodyMd: "Body",
      whyItMattersMd: "Why",
      uncertaintyMd: "Unknowns",
      evidenceStatus: "supported",
      status: "published",
      visibility: "public",
      primaryRef: { type: "campaign", id: "campaign-1" },
      linkedIds: {
        thesisIds: ["thesis-1"],
        hypothesisIds: [],
        recipeIds: [],
        compositionIds: [],
        listeningSessionIds: [],
        failureKeys: [],
      },
      publicEvidenceCards: [],
      createdBy: "system",
      createdAt: 1,
      updatedAt: 2,
      publishedAt: 3,
    } as Doc<"editorialArtifacts">;

    const rendered = await buildExportEntry(artifact, "https://app.example.com", {
      campaignSlug: "harmonic-drift",
      thesisSlugs: ["drift-as-form"],
    });

    expect(rendered.path).toBe("campaign-summary.md");
    expect(rendered.markdown).toContain('campaignSlug: "harmonic-drift"');
    expect(rendered.markdown).toContain('thesisSlugs: ["drift-as-form"]');
    expect(rendered.markdown).toContain("## Why It Matters");
    expect(rendered.manifestEntry.slug).toBe("campaign-summary");
  });

  test("weekly brief drafts only carry public evidence cards", async () => {
    const brief = {
      _id: "brief-1",
      weekOf: "2026-03-31",
      sourceIds: ["source-public", "source-private"],
      recommendedHypothesisIds: [],
      recommendedRecipeIds: [],
      activeThesisIds: [],
      referencedFailureKeys: [],
      recommendedActions: [],
      todo: [],
    } as unknown as Doc<"weeklyBriefs">;

    const db = makeDb({
      campaigns: [],
      theses: [],
      hypotheses: [],
      recipes: [],
      compositions: [],
      listeningSessions: [],
      weeklyBriefs: [brief],
      editorialArtifacts: [],
      sources: [
        {
          _id: "source-public",
          title: "Public source",
          canonicalUrl: "https://example.com/public",
          visibility: "public",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 1,
        },
        {
          _id: "source-private",
          title: "Private source",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      extractions: [
        {
          _id: "extract-public",
          sourceId: "source-public",
          summary: "Public extraction summary",
          createdAt: 1,
          claims: [],
          compositionParameters: [],
          topics: [],
        },
      ],
    });

    const payload = await buildWeeklyBriefDraft(db as any, brief);

    expect(payload.publicEvidenceCards).toHaveLength(1);
    expect(payload.publicEvidenceCards[0]?.sourceTitle).toBe("Public source");
  });

  test("what_changed_my_mind drafts require a contradicted hypothesis", async () => {
    const thesis = {
      _id: "thesis-1",
      title: "Thesis",
      statement: "Statement",
    } as Doc<"theses">;
    const db = makeDb({
      campaigns: [],
      theses: [thesis],
      hypotheses: [
        {
          _id: "hyp-1",
          title: "Hypothesis",
          question: "Q",
          hypothesis: "H",
          whyThisMatters: "W",
          rationaleMd: "R",
          thesisId: "thesis-1",
          sourceIds: [],
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      recipes: [],
      compositions: [],
      listeningSessions: [],
      sources: [],
      extractions: [],
      weeklyBriefs: [],
      editorialArtifacts: [],
    });

    await expect(
      buildThesisDraft(db as any, thesis, { kind: "what_changed_my_mind" }),
    ).rejects.toThrow(ConvexError);
  });
});
