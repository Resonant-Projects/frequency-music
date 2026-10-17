import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const BYPASS = "local-vocabulary-test-bypass";

function setup() {
  vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
  vi.stubEnv("AUTH_BYPASS_SECRET", BYPASS);
  return convexTest(schema, modules);
}

type T = ReturnType<typeof setup>;
type Parameter = Doc<"extractions">["compositionParameters"][number];

afterEach(() => {
  vi.unstubAllEnvs();
});

const insertKind = (
  t: T,
  name: string,
  extra: Partial<Doc<"parameterKinds">> = {},
) =>
  t.run((ctx) =>
    ctx.db.insert("parameterKinds", {
      name,
      status: "known",
      introducedBy: "system",
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    }),
  );

const insertSource = (t: T, key: string) =>
  t.run((ctx) =>
    ctx.db.insert("sources", {
      type: "url",
      title: `Source ${key}`,
      canonicalUrl: `https://example.org/${key}`,
      status: "text_ready",
      dedupeKey: `url:${key}`,
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    }),
  );

async function storeParameters(
  t: T,
  key: string,
  compositionParameters: Parameter[],
) {
  const sourceId = await insertSource(t, key);
  const { extractionId } = await t.mutation(
    internal.extractInternal.storeExtraction,
    {
      sourceId,
      model: "test-model",
      promptVersion: "test",
      inputHash: `hash:${key}`,
      summary: "summary",
      claims: [],
      compositionParameters,
      topics: [],
      openQuestions: [],
      confidence: 0.5,
    },
  );
  return await t.run(
    async (ctx) => (await ctx.db.get(extractionId))?.compositionParameters,
  );
}

const insertExtraction = (t: T, key: string, parameters: Parameter[]) =>
  t.run(async (ctx) => {
    const sourceId = await ctx.db.insert("sources", {
      type: "url",
      title: `Source ${key}`,
      canonicalUrl: `https://example.org/${key}`,
      status: "extracted",
      dedupeKey: `url:${key}`,
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    return await ctx.db.insert("extractions", {
      sourceId,
      model: "test-model",
      promptVersion: "test",
      inputHash: `hash:${key}`,
      summary: "summary",
      claims: [],
      compositionParameters: parameters,
      topics: [],
      openQuestions: [],
      confidence: 0.5,
      createdBy: "system",
      createdAt: 1,
    });
  });

describe("ensureParameterKind merge aliasing", () => {
  test("a merged kind resolves to its target's status and name", async () => {
    const t = setup();
    const chord = await insertKind(t, "chord");
    await insertKind(t, "chordtype", {
      status: "deprecated",
      mergedInto: String(chord),
    });

    expect(
      await t.mutation(internal.vocabulary.ensureParameterKind, {
        name: "chordType",
      }),
    ).toEqual({ status: "known", name: "chord", merged: true });
  });

  test("follows a merge chain to its end", async () => {
    const t = setup();
    const chord = await insertKind(t, "chord");
    const chordType = await insertKind(t, "chordtype", {
      status: "deprecated",
      mergedInto: String(chord),
    });
    await insertKind(t, "chordquality", {
      status: "deprecated",
      mergedInto: String(chordType),
    });

    expect(
      await t.mutation(internal.vocabulary.ensureParameterKind, {
        name: "chord quality",
      }),
    ).toEqual({ status: "known", name: "chord", merged: true });
  });

  test("a rejected kind stays deprecated under its own name", async () => {
    const t = setup();
    await insertKind(t, "vibe", { status: "deprecated" });

    expect(
      await t.mutation(internal.vocabulary.ensureParameterKind, {
        name: "Vibe",
      }),
    ).toEqual({ status: "deprecated", name: "vibe", merged: false });
  });

  test("a merge cycle or dangling link leaves the row unresolved", async () => {
    const t = setup();
    const a = await insertKind(t, "loopa", { status: "deprecated" });
    const b = await insertKind(t, "loopb", {
      status: "deprecated",
      mergedInto: String(a),
    });
    await t.run((ctx) => ctx.db.patch(a, { mergedInto: String(b) }));
    const gone = await insertKind(t, "gone");
    await t.run((ctx) => ctx.db.delete(gone));
    await insertKind(t, "dangling", {
      status: "deprecated",
      mergedInto: String(gone),
    });

    expect(
      await t.mutation(internal.vocabulary.ensureParameterKind, {
        name: "loopA",
      }),
    ).toEqual({ status: "deprecated", name: "loopa", merged: false });
    expect(
      await t.mutation(internal.vocabulary.ensureParameterKind, {
        name: "dangling",
      }),
    ).toEqual({ status: "deprecated", name: "dangling", merged: false });
  });

  test("an extraction using a merged name canonicalizes to the target", async () => {
    const t = setup();
    const chord = await insertKind(t, "chord");
    await insertKind(t, "chordtype", {
      status: "deprecated",
      mergedInto: String(chord),
    });
    await insertKind(t, "vibe", { status: "deprecated" });

    expect(
      await storeParameters(t, "merged", [
        { kind: "chordType", value: "maj7" },
        { kind: "Vibe", value: "warm" },
        { kind: "tempo", value: "120bpm" },
      ]),
    ).toEqual([
      {
        kind: "chordType",
        type: "chordType",
        value: "maj7",
        registryStatus: "known",
        canonicalKind: "chord",
      },
      {
        kind: "Vibe",
        type: "Vibe",
        value: "warm",
        registryStatus: "deprecated",
        canonicalKind: "Vibe",
      },
      {
        kind: "tempo",
        type: "tempo",
        value: "120bpm",
        registryStatus: "known",
        canonicalKind: "tempo",
      },
    ]);
  });
});

describe("mergeVocabularyReferenceBatch parameter kinds", () => {
  test("rewrites every spelling of the merged source", async () => {
    const t = setup();
    const chord = await insertKind(t, "chord");
    const chordType = await insertKind(t, "chordtype", {
      status: "deprecated",
      mergedInto: String(chord),
    });
    const camel = await insertExtraction(t, "camel", [
      {
        kind: "chordType",
        type: "chordType",
        value: "maj7",
        registryStatus: "provisional",
        canonicalKind: "chordType",
      },
      { kind: "tempo", type: "tempo", value: "120bpm" },
    ]);
    const spaced = await insertExtraction(t, "spaced", [
      { type: "Chord Type", value: "dim" },
    ]);
    const unrelated = await insertExtraction(t, "unrelated", [
      { kind: "chord", value: "C" },
    ]);

    const run = (apply: boolean) =>
      t.mutation(api.vocabulary.mergeVocabularyReferenceBatch, {
        list: "parameterKind",
        sourceEntryId: String(chordType),
        targetEntryId: String(chord),
        cursor: null,
        batchSize: 100,
        apply,
        devBypassSecret: BYPASS,
      });

    expect(await run(false)).toMatchObject({ processed: 3, remapped: 2 });
    expect(await run(true)).toMatchObject({ processed: 3, remapped: 2 });

    const parameters = (id: Id<"extractions">) =>
      t.run(async (ctx) => (await ctx.db.get(id))?.compositionParameters);
    expect(await parameters(camel)).toEqual([
      {
        kind: "chord",
        type: "chordType",
        value: "maj7",
        registryStatus: "known",
        canonicalKind: "chord",
      },
      { kind: "tempo", type: "tempo", value: "120bpm" },
    ]);
    expect(await parameters(spaced)).toEqual([
      {
        kind: "chord",
        type: "Chord Type",
        value: "dim",
        registryStatus: "known",
        canonicalKind: "chord",
      },
    ]);
    expect(await parameters(unrelated)).toEqual([
      { kind: "chord", value: "C" },
    ]);

    // Rewritten rows no longer match, so a rerun is a no-op.
    expect(await run(true)).toMatchObject({ remapped: 0 });
  });
});
