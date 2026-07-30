/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { getNonDeprecatedConceptDomains } from "../convex/vocabulary";
import { modules } from "./modules";

const now = 1_000;

async function seedConceptDomainPair(
  t: ReturnType<typeof convexTest>,
  options: { sourceName?: string; targetStatus?: "known" | "provisional" } = {},
) {
  return t.run(async (ctx) => {
    const targetId = await ctx.db.insert("conceptDomains", {
      name: "wave-physics",
      status: options.targetStatus ?? "known",
      introducedBy: "system",
      createdAt: now,
      updatedAt: now,
    });
    const sourceId = await ctx.db.insert("conceptDomains", {
      name: options.sourceName ?? "physics-of-sound",
      status: "provisional",
      introducedBy: "system",
      createdAt: now,
      updatedAt: now,
    });
    return { sourceId, targetId };
  });
}

async function insertConcept(
  t: ReturnType<typeof convexTest>,
  name: string,
  domain: string,
  domains?: string[],
) {
  return t.run((ctx) =>
    ctx.db.insert("concepts", {
      name,
      displayName: name,
      aliases: [],
      domain,
      domains,
      mentionCount: 0,
      hypothesisCount: 0,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe("parameter kind normalization", () => {
  test("resolves separator and casing variants to the same canonical kind", async () => {
    const t = convexTest(schema, modules);

    for (const variant of [
      "tuning system",
      "tuning_system",
      "Tuning-System",
      "  TUNINGSYSTEM  ",
    ]) {
      expect(
        await t.mutation(internal.vocabulary.ensureParameterKind, {
          name: variant,
        }),
      ).toEqual({ status: "known" });
    }

    const rows = await t.run((ctx) => ctx.db.query("parameterKinds").collect());
    expect(rows.map((row) => row.name)).toEqual(["tuningSystem"]);
  });

  test("dedupes non-canonical kinds across ensure and seed on one key", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });

    expect(
      await t.mutation(internal.vocabulary.ensureParameterKind, {
        name: "Custom Thing",
      }),
    ).toEqual({ status: "provisional" });

    // Same kind, different casing/separator — must update the existing row
    // rather than insert a second `parameterKinds` entry.
    expect(
      await asSystem.mutation(api.vocabulary.seedKnownParameterKinds, {
        names: ["custom_thing"],
        apply: true,
      }),
    ).toMatchObject({ created: 0, updated: 1, unchanged: 0 });

    const rows = await t.run((ctx) => ctx.db.query("parameterKinds").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "customthing", status: "known" });
  });

  test("counts each normalized variant once in a dry run", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });

    expect(
      await asSystem.mutation(api.vocabulary.seedKnownParameterKinds, {
        names: ["tuning system", "tuning_system", "Tuning-System"],
        apply: false,
      }),
    ).toMatchObject({ created: 1, updated: 0, unchanged: 0 });

    expect(
      await asSystem.mutation(api.vocabulary.seedKnownRelationshipKinds, {
        names: ["related_to", " RELATED_TO ", "related_to"],
        apply: false,
      }),
    ).toMatchObject({ created: 1, updated: 0, unchanged: 0 });
  });

  test("rekeys legacy separator-bearing rows and merges collisions", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });

    await t.run(async (ctx) => {
      for (const name of [
        "drive_frequency", // legacy provisional -> rename to drivefrequency
        "tuning system", // legacy canonical -> rename to tuningSystem
        "reverb_time", // legacy provisional, collides with reverbtime below
        "reverbtime", // already correctly keyed
        "tempo", // already correct, untouched
      ]) {
        await ctx.db.insert("parameterKinds", {
          name,
          status: "provisional",
          introducedBy: "system",
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    const preview = await asSystem.mutation(
      api.vocabulary.rekeyLegacyParameterKinds,
      { apply: false },
    );
    expect(preview.renamed).toEqual(
      expect.arrayContaining([
        { from: "drive_frequency", to: "drivefrequency" },
        { from: "tuning system", to: "tuningSystem" },
      ]),
    );
    expect(preview.merged).toEqual([
      { from: "reverb_time", into: "reverbtime" },
    ]);
    expect(preview.unchanged).toBe(2);

    // Preview must not have written anything.
    expect(
      (await t.run((ctx) => ctx.db.query("parameterKinds").collect()))
        .map((row) => row.name)
        .sort(),
    ).toEqual([
      "drive_frequency",
      "reverb_time",
      "reverbtime",
      "tempo",
      "tuning system",
    ]);

    await asSystem.mutation(api.vocabulary.rekeyLegacyParameterKinds, {
      apply: true,
    });

    const rows = await t.run((ctx) => ctx.db.query("parameterKinds").collect());
    expect(
      rows
        .filter((row) => row.status !== "deprecated")
        .map((row) => row.name)
        .sort(),
    ).toEqual(["drivefrequency", "reverbtime", "tempo", "tuningSystem"]);
    expect(rows.find((row) => row.status === "deprecated")).toMatchObject({
      name: "reverb_time",
      mergedInto: String(rows.find((row) => row.name === "reverbtime")!._id),
    });

    // The migrated rows are now reachable through the live lookup path.
    expect(
      await t.mutation(internal.vocabulary.ensureParameterKind, {
        name: "Drive-Frequency",
      }),
    ).toEqual({ status: "provisional" });
    expect(
      await t.run((ctx) => ctx.db.query("parameterKinds").collect()),
    ).toHaveLength(rows.length);
  });

  test("promotes status without rewriting introducedBy", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        clerkUserId: "clerk|operator",
        role: "collaborator",
        createdAt: now,
        updatedAt: now,
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("parameterKinds", {
        name: "tempo",
        status: "provisional",
        introducedBy: userId,
        createdAt: now,
        updatedAt: now,
      }),
    );

    expect(
      await asSystem.mutation(api.vocabulary.seedKnownParameterKinds, {
        names: ["tempo"],
        apply: true,
      }),
    ).toMatchObject({ created: 0, updated: 1, unchanged: 0 });

    const [row] = await t.run((ctx) =>
      ctx.db.query("parameterKinds").collect(),
    );
    expect(row).toMatchObject({ status: "known", introducedBy: userId });

    // Already known — nothing left to promote, and attribution stays put.
    expect(
      await asSystem.mutation(api.vocabulary.seedKnownParameterKinds, {
        names: ["tempo"],
        apply: true,
      }),
    ).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
  });

  test("previews the same rename/merge split that apply performs", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });

    // Two legacy spellings collapsing onto one target that does not yet exist.
    await t.run(async (ctx) => {
      for (const name of ["drive_frequency", "drive frequency"]) {
        await ctx.db.insert("parameterKinds", {
          name,
          status: "provisional",
          introducedBy: "system",
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    const preview = await asSystem.mutation(
      api.vocabulary.rekeyLegacyParameterKinds,
      { apply: false },
    );
    const applied = await asSystem.mutation(
      api.vocabulary.rekeyLegacyParameterKinds,
      { apply: true },
    );

    expect(preview).toEqual(applied);
    expect(preview.renamed).toHaveLength(1);
    expect(preview.merged).toHaveLength(1);

    const rows = await t.run((ctx) => ctx.db.query("parameterKinds").collect());
    expect(
      rows.filter((row) => row.status !== "deprecated").map((row) => row.name),
    ).toEqual(["drivefrequency"]);
  });

  test("seeds canonical kinds under their camelCase display name", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });

    expect(
      await asSystem.mutation(api.vocabulary.seedKnownParameterKinds, {
        names: ["chord progression", "Synth-Waveform"],
        apply: true,
      }),
    ).toMatchObject({ created: 2, updated: 0, unchanged: 0 });

    const rows = await t.run((ctx) => ctx.db.query("parameterKinds").collect());
    expect(rows.map((row) => row.name).sort()).toEqual([
      "chordProgression",
      "synthWaveform",
    ]);
  });
});

describe("vocabulary triage decisions", () => {
  test("promotes a provisional entry and records the server-derived operator", async () => {
    const t = convexTest(schema, modules);
    const asOperator = t.withIdentity({ subject: "operator-123" });
    const entryId = await t.run((ctx) =>
      ctx.db.insert("parameterKinds", {
        name: "duration",
        status: "provisional",
        introducedBy: "system",
        createdAt: now,
        updatedAt: now,
      }),
    );

    const result = await asOperator.mutation(api.vocabulary.promoteEntry, {
      list: "parameterKind",
      entryId,
      note: "Useful composition control.",
    });

    expect(result).toMatchObject({ entryId, status: "known" });
    const entry = await t.run((ctx) => ctx.db.get("parameterKinds", entryId));
    expect(entry).toMatchObject({
      status: "known",
      decidedBy: "operator-123",
      decisionNote: "Useful composition control.",
    });
    expect(entry?.decidedAt).toEqual(expect.any(Number));
    expect(entry?.decidedAt).toBeGreaterThan(now);
  });

  test("rejects a provisional entry without deleting it", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const entryId = await t.run((ctx) =>
      ctx.db.insert("relationshipKinds", {
        name: "contextualizes",
        status: "provisional",
        introducedBy: "system",
        createdAt: now,
        updatedAt: now,
      }),
    );

    await asSystem.mutation(api.vocabulary.rejectEntry, {
      list: "relationshipKind",
      entryId,
      note: "Too vague for the graph.",
    });

    expect(
      await t.run((ctx) => ctx.db.get("relationshipKinds", entryId)),
    ).toMatchObject({
      status: "deprecated",
      decidedBy: "system",
      decisionNote: "Too vague for the graph.",
    });
  });

  test("remaps primary concept-domain memberships inline and leaves secondary-only memberships for fallback", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { sourceId, targetId } = await seedConceptDomainPair(t);
    const primaryId = await insertConcept(
      t,
      "standing-wave",
      "physics-of-sound",
      ["physics-of-sound", "acoustics"],
    );
    const secondaryId = await insertConcept(t, "resonance", "acoustics", [
      "acoustics",
      "physics-of-sound",
    ]);

    const result = await asSystem.mutation(api.vocabulary.mergeEntry, {
      list: "conceptDomain",
      sourceEntryId: sourceId,
      targetEntryId: targetId,
    });

    expect(result).toMatchObject({ remapped: 1, alreadyMerged: false });
    const state = await t.run(async (ctx) => ({
      primary: await ctx.db.get("concepts", primaryId),
      secondary: await ctx.db.get("concepts", secondaryId),
      source: await ctx.db.get("conceptDomains", sourceId),
    }));
    expect(state.primary).toMatchObject({
      domain: "wave-physics",
      domains: ["wave-physics", "acoustics"],
    });
    expect(state.secondary).toMatchObject({
      domain: "acoustics",
      domains: ["acoustics", "physics-of-sound"],
    });
    expect(state.source).toMatchObject({
      status: "deprecated",
      mergedInto: targetId,
      decidedBy: "system",
    });
  });

  test("directs oversized primary concept-domain merges to the fallback script", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { sourceId, targetId } = await seedConceptDomainPair(t);
    await t.run(async (ctx) => {
      for (let index = 0; index < 2_001; index++) {
        await ctx.db.insert("concepts", {
          name: `oversized-domain-member-${index}`,
          displayName: `Oversized domain member ${index}`,
          aliases: [],
          domain: "physics-of-sound",
          domains: ["physics-of-sound"],
          mentionCount: 0,
          hypothesisCount: 0,
          createdAt: now + index,
          updatedAt: now + index,
        });
      }
    });

    await expect(
      asSystem.mutation(api.vocabulary.mergeEntry, {
        list: "conceptDomain",
        sourceEntryId: sourceId,
        targetEntryId: targetId,
      }),
    ).rejects.toThrow(/scripts\/merge-vocabulary-references\.ts/);

    expect(
      await t.run((ctx) => ctx.db.get("conceptDomains", sourceId)),
    ).toMatchObject({ status: "provisional" });
  });

  test("deduplicates an existing target domain membership during merge", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { sourceId, targetId } = await seedConceptDomainPair(t);
    const conceptId = await insertConcept(
      t,
      "harmonic-series",
      "physics-of-sound",
      ["physics-of-sound", "wave-physics", "acoustics"],
    );

    await asSystem.mutation(api.vocabulary.mergeEntry, {
      list: "conceptDomain",
      sourceEntryId: sourceId,
      targetEntryId: targetId,
    });

    const concept = await t.run((ctx) => ctx.db.get("concepts", conceptId));
    expect(concept?.domains).toEqual(["wave-physics", "acoustics"]);
    expect(
      concept?.domains?.filter((domain) => domain === "wave-physics"),
    ).toHaveLength(1);
  });

  test("deprecates a zero-reference merge and repeats it as a no-op", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { sourceId, targetId } = await seedConceptDomainPair(t);

    const first = await asSystem.mutation(api.vocabulary.mergeEntry, {
      list: "conceptDomain",
      sourceEntryId: sourceId,
      targetEntryId: targetId,
    });
    const repeated = await asSystem.mutation(api.vocabulary.mergeEntry, {
      list: "conceptDomain",
      sourceEntryId: sourceId,
      targetEntryId: targetId,
    });

    expect(first).toMatchObject({ remapped: 0, alreadyMerged: false });
    expect(repeated).toMatchObject({ remapped: 0, alreadyMerged: true });
    const source = await t.run((ctx) => ctx.db.get("conceptDomains", sourceId));
    expect(source).toMatchObject({
      status: "deprecated",
      mergedInto: targetId,
    });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("conceptDomains")
          .withIndex("by_status", (q) => q.eq("status", "deprecated"))
          .collect(),
      ),
    ).toHaveLength(1);

    await t.run((ctx) =>
      ctx.db.patch("conceptDomains", targetId, { status: "deprecated" }),
    );
    await expect(
      asSystem.mutation(api.vocabulary.mergeEntry, {
        list: "conceptDomain",
        sourceEntryId: sourceId,
        targetEntryId: targetId,
      }),
    ).rejects.toThrow(/known/i);
  });

  test("rejects same-entry merges and non-known merge targets", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { sourceId, targetId } = await seedConceptDomainPair(t, {
      targetStatus: "provisional",
    });

    await expect(
      asSystem.mutation(api.vocabulary.mergeEntry, {
        list: "conceptDomain",
        sourceEntryId: sourceId,
        targetEntryId: sourceId,
      }),
    ).rejects.toThrow(/different|same/i);
    await expect(
      asSystem.mutation(api.vocabulary.mergeEntry, {
        list: "conceptDomain",
        sourceEntryId: sourceId,
        targetEntryId: targetId,
      }),
    ).rejects.toThrow(/known/i);
  });

  test("rejects wrong-list ids and stale promote or reject decisions", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const conceptDomainId = await t.run((ctx) =>
      ctx.db.insert("conceptDomains", {
        name: "bioacoustics",
        status: "provisional",
        introducedBy: "system",
        createdAt: now,
        updatedAt: now,
      }),
    );

    await expect(
      asSystem.mutation(api.vocabulary.promoteEntry, {
        list: "parameterKind",
        entryId: conceptDomainId,
      }),
    ).rejects.toThrow(/list|entry/i);

    await asSystem.mutation(api.vocabulary.promoteEntry, {
      list: "conceptDomain",
      entryId: conceptDomainId,
    });
    await expect(
      asSystem.mutation(api.vocabulary.promoteEntry, {
        list: "conceptDomain",
        entryId: conceptDomainId,
      }),
    ).rejects.toThrow(/provisional|decided/i);
    await expect(
      asSystem.mutation(api.vocabulary.rejectEntry, {
        list: "conceptDomain",
        entryId: conceptDomainId,
      }),
    ).rejects.toThrow(/provisional|decided/i);
  });

  test("requires authentication for promote, reject, and merge", async () => {
    const t = convexTest(schema, modules);
    const { sourceId, targetId } = await seedConceptDomainPair(t);

    await expect(
      t.mutation(api.vocabulary.promoteEntry, {
        list: "conceptDomain",
        entryId: sourceId,
      }),
    ).rejects.toThrow(/Authentication required|UNAUTHORIZED/);
    await expect(
      t.mutation(api.vocabulary.rejectEntry, {
        list: "conceptDomain",
        entryId: sourceId,
      }),
    ).rejects.toThrow(/Authentication required|UNAUTHORIZED/);
    await expect(
      t.mutation(api.vocabulary.mergeEntry, {
        list: "conceptDomain",
        sourceEntryId: sourceId,
        targetEntryId: targetId,
      }),
    ).rejects.toThrow(/Authentication required|UNAUTHORIZED/);
  });

  test("remaps relationship-kind edge references inline", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { sourceId, targetId, edgeIds } = await t.run(async (ctx) => {
      const targetId = await ctx.db.insert("relationshipKinds", {
        name: "related_to",
        status: "known",
        introducedBy: "system",
        createdAt: now,
        updatedAt: now,
      });
      const sourceId = await ctx.db.insert("relationshipKinds", {
        name: "relates_to",
        status: "provisional",
        introducedBy: "system",
        createdAt: now,
        updatedAt: now,
      });
      const edgeIds = await Promise.all(
        ["concept-a", "concept-b"].map((fromId, index) =>
          ctx.db.insert("edges", {
            fromType: "concept",
            fromId,
            toType: "concept",
            toId: `target-${index}`,
            relationship: "relates_to",
            autoGenerated: true,
            createdAt: now,
            createdBy: "system",
          }),
        ),
      );
      return { sourceId, targetId, edgeIds };
    });

    const result = await asSystem.mutation(api.vocabulary.mergeEntry, {
      list: "relationshipKind",
      sourceEntryId: sourceId,
      targetEntryId: targetId,
    });

    expect(result.remapped).toBe(2);
    expect(
      await t.run(async (ctx) =>
        Promise.all(edgeIds.map((edgeId) => ctx.db.get("edges", edgeId))),
      ),
    ).toEqual([
      expect.objectContaining({ relationship: "related_to" }),
      expect.objectContaining({ relationship: "related_to" }),
    ]);
  });
});

describe("classifier-facing vocabulary", () => {
  test("excludes deprecated domains while retaining other registry maturities", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (const [name, status] of [
        ["known-domain", "known"],
        ["provisional-domain", "provisional"],
        ["experimental-domain", "experimental"],
        ["deprecated-domain", "deprecated"],
      ] as const) {
        await ctx.db.insert("conceptDomains", {
          name,
          status,
          introducedBy: "system",
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    const result = await t.run((ctx) => getNonDeprecatedConceptDomains(ctx));

    expect(result.map((domain) => domain.name).toSorted()).toEqual([
      "experimental-domain",
      "known-domain",
      "provisional-domain",
    ]);
  });
});

describe("vocabulary triage read and fallback surfaces", () => {
  test("returns provisional rows, bounded mentions, and same-list known targets", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("conceptDomains", {
        name: "physics-of-sound",
        status: "provisional",
        description: "A duplicate wave domain.",
        introducedBy: "system",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("conceptDomains", {
        name: "wave-physics",
        status: "known",
        introducedBy: "system",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("parameterKinds", {
        name: "duration",
        status: "provisional",
        introducedBy: "system",
        createdAt: now,
        updatedAt: now,
      });
    });
    await insertConcept(t, "standing-wave", "physics-of-sound");

    const board = await t.query(api.vocabulary.triageBoard, {});

    expect(board.conceptDomains.provisional).toEqual([
      expect.objectContaining({
        name: "physics-of-sound",
        mentionCount: 1,
        mentionCountCapped: false,
      }),
    ]);
    expect(board.conceptDomains.knownTargets).toEqual([
      expect.objectContaining({ name: "wave-physics" }),
    ]);
    expect(board.parameterKinds.provisional).toEqual([
      expect.objectContaining({ name: "duration", mentionCount: null }),
    ]);
  });

  test("rewrites parameter-kind references through bounded authenticated batches", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { sourceEntryId, targetEntryId, extractionId } = await t.run(
      async (ctx) => {
        const targetEntryId = await ctx.db.insert("parameterKinds", {
          name: "harmonicprofile",
          status: "known",
          introducedBy: "system",
          createdAt: now,
          updatedAt: now,
        });
        const sourceEntryId = await ctx.db.insert("parameterKinds", {
          name: "timbre",
          status: "provisional",
          introducedBy: "system",
          createdAt: now,
          updatedAt: now,
        });
        const sourceId = await ctx.db.insert("sources", {
          type: "url",
          status: "extracted",
          dedupeKey: "url:example.com/vocabulary-fallback",
          visibility: "private",
          createdBy: "system",
          createdAt: now,
          updatedAt: now,
        });
        const extractionId = await ctx.db.insert("extractions", {
          sourceId,
          model: "test-model",
          promptVersion: "test",
          inputHash: "vocabulary-fallback",
          summary: "Fallback fixture.",
          claims: [],
          compositionParameters: [{ kind: "timbre", value: "bright" }],
          topics: [],
          openQuestions: [],
          confidence: 1,
          createdBy: "system",
          createdAt: now,
        });
        return { sourceEntryId, targetEntryId, extractionId };
      },
    );
    await asSystem.mutation(api.vocabulary.mergeEntry, {
      list: "parameterKind",
      sourceEntryId,
      targetEntryId,
    });

    const batch = await asSystem.mutation(
      api.vocabulary.mergeVocabularyReferenceBatch,
      {
        list: "parameterKind",
        sourceEntryId,
        targetEntryId,
        cursor: null,
        batchSize: 10,
        apply: true,
      },
    );

    expect(batch).toMatchObject({ processed: 1, remapped: 1, isDone: true });
    expect(
      await t.run((ctx) => ctx.db.get("extractions", extractionId)),
    ).toMatchObject({
      compositionParameters: [{ kind: "harmonicprofile", value: "bright" }],
    });
  });

  test("rewrites secondary-only concept-domain memberships through the fallback batch", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { sourceId, targetId } = await seedConceptDomainPair(t);
    const conceptId = await insertConcept(t, "resonance", "acoustics", [
      "acoustics",
      "physics-of-sound",
      "wave-physics",
    ]);

    expect(
      await asSystem.mutation(api.vocabulary.mergeEntry, {
        list: "conceptDomain",
        sourceEntryId: sourceId,
        targetEntryId: targetId,
      }),
    ).toMatchObject({ remapped: 0, alreadyMerged: false });
    expect(
      await t.run((ctx) => ctx.db.get("concepts", conceptId)),
    ).toMatchObject({
      domain: "acoustics",
      domains: ["acoustics", "physics-of-sound", "wave-physics"],
    });

    const batch = await asSystem.mutation(
      api.vocabulary.mergeVocabularyReferenceBatch,
      {
        list: "conceptDomain",
        sourceEntryId: sourceId,
        targetEntryId: targetId,
        cursor: null,
        batchSize: 10,
        apply: true,
      },
    );

    expect(batch).toMatchObject({ processed: 1, remapped: 1, isDone: true });
    expect(
      await t.run((ctx) => ctx.db.get("concepts", conceptId)),
    ).toMatchObject({
      domain: "acoustics",
      domains: ["acoustics", "wave-physics"],
    });
  });

  test("rewrites primary concept-domain memberships before finalizing a fallback merge", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { sourceId, targetId } = await seedConceptDomainPair(t);
    const conceptId = await insertConcept(
      t,
      "fallback-primary-member",
      "physics-of-sound",
      ["physics-of-sound", "wave-physics", "acoustics"],
    );

    const batch = await asSystem.mutation(
      api.vocabulary.mergeVocabularyReferenceBatch,
      {
        list: "conceptDomain",
        sourceEntryId: sourceId,
        targetEntryId: targetId,
        cursor: null,
        batchSize: 10,
        apply: true,
      },
    );

    expect(batch).toMatchObject({ processed: 1, remapped: 1, isDone: true });
    expect(
      await t.run((ctx) => ctx.db.get("concepts", conceptId)),
    ).toMatchObject({
      domain: "wave-physics",
      domains: ["wave-physics", "acoustics"],
    });
    expect(
      await asSystem.mutation(api.vocabulary.mergeEntry, {
        list: "conceptDomain",
        sourceEntryId: sourceId,
        targetEntryId: targetId,
      }),
    ).toMatchObject({ remapped: 0, alreadyMerged: false });
    expect(
      await t.run((ctx) => ctx.db.get("conceptDomains", sourceId)),
    ).toMatchObject({ status: "deprecated", mergedInto: targetId });
  });
});
