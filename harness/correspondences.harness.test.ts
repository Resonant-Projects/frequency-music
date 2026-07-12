/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { AUTO_RETIRE_AFTER_MS } from "../convex/correspondences";
import schema from "../convex/schema";
import { pairKey } from "../convex/shared/correspondenceKey";
import { modules } from "./modules";

type Harness = ReturnType<typeof convexTest>;

async function seedUser(t: Harness) {
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkUserId: "clerk-test-user",
      role: "admin",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
}

async function seedAgentRun(t: Harness) {
  return await t.run((ctx) =>
    ctx.db.insert("agentRuns", {
      graphName: "correspondence-miner",
      status: "running",
      input: null,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
}

async function seedConcept(
  t: Harness,
  name: string,
  options: {
    domains?: string[];
    missionRelevance?: "on" | "off" | "unreviewed";
  } = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert("concepts", {
      name,
      displayName: name,
      aliases: [],
      domain: options.domains?.[0] ?? "general",
      domains: options.domains,
      missionRelevance: options.missionRelevance,
      mentionCount: 1,
      hypothesisCount: 0,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
}

async function seedClaim(t: Harness, ordinal: number) {
  return await t.run(async (ctx) => {
    const sourceId = await ctx.db.insert("sources", {
      type: "url",
      status: "extracted",
      dedupeKey: `url:claim-${ordinal}`,
      visibility: "private",
      createdBy: "system",
      createdAt: ordinal + 1,
      updatedAt: ordinal + 1,
    });
    const extractionId = await ctx.db.insert("extractions", {
      sourceId,
      model: "test-model",
      promptVersion: "test",
      inputHash: `claim-${ordinal}`,
      summary: "test",
      claims: [],
      compositionParameters: [],
      topics: [],
      openQuestions: [],
      confidence: 1,
      createdBy: "system",
      createdAt: ordinal + 1,
    });
    return await ctx.db.insert("claims", {
      extractionId,
      sourceId,
      ordinal,
      text: `Claim ${ordinal}`,
      evidenceLevel: "peer_reviewed",
      citations: [],
      status: "active",
      createdBy: "system",
      createdAt: ordinal + 1,
    });
  });
}

async function seedValidPair(t: Harness, suffix = "") {
  const [conceptAId, conceptBId] = await Promise.all([
    seedConcept(t, `cymatics${suffix}`, {
      domains: ["cymatics"],
      missionRelevance: "on",
    }),
    seedConcept(t, `tonnetz${suffix}`, {
      domains: ["mathematics", "music-theory"],
      missionRelevance: "on",
    }),
  ]);
  return { conceptAId, conceptBId };
}

async function upsertAsAgent(
  t: Harness,
  agentRunId: Id<"agentRuns">,
  conceptAId: Id<"concepts">,
  conceptBId: Id<"concepts">,
  rationaleMd = "Initial rationale",
) {
  return await t.mutation(internal.correspondences.upsertConjectureFromAgent, {
    conceptAId,
    conceptBId,
    statement: "These concepts may share a structural correspondence.",
    rationaleMd,
    agentRunId,
  });
}

describe("correspondence pair identity and classification gates", () => {
  test("upsert is idempotent in both orders and merges rationale + higher scores", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const { conceptAId, conceptBId } = await seedValidPair(t);

    const first = await t.mutation(
      internal.correspondences.upsertConjectureFromAgent,
      {
        conceptAId,
        conceptBId,
        statement: "A cross-domain statement.",
        rationaleMd: "First rationale",
        similarityScore: 0.4,
        noveltyScore: 0.8,
        agentRunId,
      },
    );
    const second = await t.mutation(
      internal.correspondences.upsertConjectureFromAgent,
      {
        conceptAId: conceptBId,
        conceptBId: conceptAId,
        statement: "Rediscovered statement.",
        rationaleMd: "Second rationale",
        similarityScore: 0.9,
        noveltyScore: 0.2,
        agentRunId,
      },
    );

    expect(first.created).toBe(true);
    expect(second).toEqual({ id: first.id, created: false });
    const rows = await t.run((ctx) =>
      ctx.db
        .query("correspondences")
        .withIndex("by_pairKey", (q) =>
          q.eq("pairKey", pairKey(conceptAId, conceptBId)),
        )
        .take(2),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rationaleMd).toContain("First rationale");
    expect(rows[0]?.rationaleMd).toContain("Addendum:\nSecond rationale");
    expect(rows[0]?.similarityScore).toBe(0.9);
    expect(rows[0]?.noveltyScore).toBe(0.8);
    expect(rows[0]?.pairKey).toBe(pairKey(conceptBId, conceptAId));
  });

  test("rejects identical domain sets even when their order differs", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const [conceptAId, conceptBId] = await Promise.all([
      seedConcept(t, "same-a", {
        domains: ["music-theory", "mathematics"],
        missionRelevance: "on",
      }),
      seedConcept(t, "same-b", {
        domains: ["mathematics", "music-theory"],
        missionRelevance: "on",
      }),
    ]);

    await expect(
      upsertAsAgent(t, agentRunId, conceptAId, conceptBId),
    ).rejects.toThrow(/different domain sets|SAME_DOMAIN_PAIR/);
  });

  test("rejects an off-mission concept", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const [conceptAId, conceptBId] = await Promise.all([
      seedConcept(t, "on-mission", {
        domains: ["cymatics"],
        missionRelevance: "on",
      }),
      seedConcept(t, "off-mission", {
        domains: ["ml-audio-engineering"],
        missionRelevance: "off",
      }),
    ]);

    await expect(
      upsertAsAgent(t, agentRunId, conceptAId, conceptBId),
    ).rejects.toThrow(/on-mission|OFF_MISSION_CONCEPT/);
  });

  test("rejects missing, empty, and unreviewed classification", async () => {
    const cases = [
      { domains: undefined, missionRelevance: "on" as const },
      { domains: [], missionRelevance: "on" as const },
      { domains: ["cymatics"], missionRelevance: "unreviewed" as const },
      { domains: ["cymatics"], missionRelevance: undefined },
    ];
    for (const [index, classification] of cases.entries()) {
      const t = convexTest(schema, modules);
      const agentRunId = await seedAgentRun(t);
      const classifiedId = await seedConcept(t, `classified-${index}`, {
        domains: ["mathematics"],
        missionRelevance: "on",
      });
      const unclassifiedId = await seedConcept(
        t,
        `unclassified-${index}`,
        classification,
      );
      await expect(
        upsertAsAgent(t, agentRunId, classifiedId, unclassifiedId),
      ).rejects.toThrow(/classified missionRelevance and domains|UNCLASSIFIED/);
    }
  });
});

describe("correspondence evidence lifecycle", () => {
  test("recomputes from evidence counts and dedupes claim + stance", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const { conceptAId, conceptBId } = await seedValidPair(t);
    const { id } = await upsertAsAgent(t, agentRunId, conceptAId, conceptBId);
    const [supportClaimId, contradictionAId, contradictionBId] =
      await Promise.all([seedClaim(t, 0), seedClaim(t, 1), seedClaim(t, 2)]);

    const support = await t.mutation(
      internal.correspondences.addEvidenceFromAgent,
      {
        correspondenceId: id,
        claimId: supportClaimId,
        stance: "supports",
        agentRunId,
      },
    );
    expect(support).toEqual({ added: true, status: "evidenced" });

    const duplicate = await t.mutation(
      internal.correspondences.addEvidenceFromAgent,
      {
        correspondenceId: id,
        claimId: supportClaimId,
        stance: "supports",
        note: "Duplicate note must not create another citation",
        agentRunId,
      },
    );
    expect(duplicate).toEqual({ added: false, status: "evidenced" });

    await t.mutation(internal.correspondences.addEvidenceFromAgent, {
      correspondenceId: id,
      claimId: contradictionAId,
      stance: "contradicts",
      agentRunId,
    });
    const outweighed = await t.mutation(
      internal.correspondences.addEvidenceFromAgent,
      {
        correspondenceId: id,
        claimId: contradictionBId,
        stance: "contradicts",
        agentRunId,
      },
    );
    expect(outweighed.status).toBe("contradicted");

    const row = await t.run((ctx) => ctx.db.get("correspondences", id));
    expect(row?.evidence).toHaveLength(3);
    expect(
      row?.evidence.every((citation) => citation.addedBy === "agent"),
    ).toBe(true);
  });
});

describe("correspondence setStatus guard", () => {
  test("allows every human transition with a reason", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    const asHuman = t.withIdentity({ subject: userId });
    const agentRunId = await seedAgentRun(t);
    const { conceptAId, conceptBId } = await seedValidPair(t);
    const { id } = await upsertAsAgent(t, agentRunId, conceptAId, conceptBId);
    const statuses = [
      "conjectured",
      "evidenced",
      "contradicted",
      "retired",
    ] as const;

    for (const source of statuses) {
      for (const target of statuses) {
        await t.run((ctx) =>
          ctx.db.patch("correspondences", id, { status: source }),
        );
        await expect(
          asHuman.mutation(api.correspondences.setStatus, {
            correspondenceId: id,
            status: target,
            statusReason: `${source} to ${target}`,
          }),
        ).resolves.toBeNull();
      }
    }
  });

  test("requires a human reason and enforces the complete agent/system matrix", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    const asHuman = t.withIdentity({ subject: userId });
    const asSystem = t.withIdentity({ subject: "system" });
    const agentRunId = await seedAgentRun(t);
    const { conceptAId, conceptBId } = await seedValidPair(t);
    const { id } = await upsertAsAgent(t, agentRunId, conceptAId, conceptBId);

    await expect(
      asHuman.mutation(api.correspondences.setStatus, {
        correspondenceId: id,
        status: "evidenced",
        statusReason: "   ",
      }),
    ).rejects.toThrow(/statusReason is required|STATUS_REASON_REQUIRED/);
    const statuses = [
      "conjectured",
      "evidenced",
      "contradicted",
      "retired",
    ] as const;
    for (const actor of ["agent", "system"] as const) {
      for (const source of statuses) {
        for (const target of statuses) {
          await t.run((ctx) =>
            ctx.db.patch("correspondences", id, { status: source }),
          );
          const transition =
            actor === "agent"
              ? asHuman.mutation(api.correspondences.setStatus, {
                  correspondenceId: id,
                  status: target,
                  statusReason: `${actor}: ${source} to ${target}`,
                  agentRunId,
                })
              : asSystem.mutation(api.correspondences.setStatus, {
                  correspondenceId: id,
                  status: target,
                  statusReason: `${actor}: ${source} to ${target}`,
                });
          if (source === "conjectured" && target === "retired") {
            await expect(transition).resolves.toBeNull();
          } else {
            await expect(transition).rejects.toThrow(
              /only retire conjectured|INVALID_STATUS_TRANSITION/,
            );
          }
        }
      }
    }
  });
});

describe("correspondence query surface", () => {
  test("finds canonical pairs, statuses, either concept side, and recent movement", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const { conceptAId, conceptBId } = await seedValidPair(t);
    const created = await upsertAsAgent(t, agentRunId, conceptBId, conceptAId);
    const claimId = await seedClaim(t, 20);
    await t.mutation(internal.correspondences.addEvidenceFromAgent, {
      correspondenceId: created.id,
      claimId,
      stance: "supports",
      agentRunId,
    });
    const row = await t.run((ctx) => ctx.db.get("correspondences", created.id));
    expect(row?.status).toBe("evidenced");

    expect(
      await t.query(api.correspondences.getByPairKey, {
        pairKey: pairKey(conceptAId, conceptBId),
      }),
    ).toMatchObject({ _id: created.id });
    expect(
      await t.query(api.correspondences.listByStatus, {
        status: "evidenced",
      }),
    ).toHaveLength(1);
    expect(
      await t.query(api.correspondences.listForConcept, {
        conceptId: conceptAId,
      }),
    ).toHaveLength(1);
    expect(
      await t.query(api.correspondences.listForConcept, {
        conceptId: conceptBId,
      }),
    ).toHaveLength(1);
    expect(
      await t.query(api.correspondences.listRecentMovement, {
        since: (row?.evidence[0]?.addedAt ?? 0) - 1,
      }),
    ).toHaveLength(1);

    const rationaleOnlyUpdateAt = (row?.updatedAt ?? 0) + 100;
    await t.run((ctx) =>
      ctx.db.patch("correspondences", created.id, {
        rationaleMd: `${row?.rationaleMd}\n\nAddendum:\nRediscovered`,
        updatedAt: rationaleOnlyUpdateAt,
      }),
    );
    expect(
      await t.query(api.correspondences.listRecentMovement, {
        since: rationaleOnlyUpdateAt - 1,
      }),
    ).toEqual([]);
  });
});

describe("correspondence auto-retirement", () => {
  test("retires only evidence-free conjectures stale for 90 days using injected time", async () => {
    const t = convexTest(schema, modules);
    const now = 200 * 24 * 60 * 60 * 1000;
    const staleAt = now - AUTO_RETIRE_AFTER_MS - 1;
    const freshAt = now - AUTO_RETIRE_AFTER_MS + 1;
    const claimId = await seedClaim(t, 10);
    const [staleId, freshId, evidencedConjectureId] = await t.run(
      async (ctx) => {
        const conceptIds = await Promise.all(
          ["a", "b", "c", "d", "e", "f"].map((name, index) =>
            ctx.db.insert("concepts", {
              name,
              displayName: name,
              aliases: [],
              domain: `domain-${index}`,
              domains: [`domain-${index}`],
              missionRelevance: "on" as const,
              mentionCount: 1,
              hypothesisCount: 0,
              createdAt: 1,
              updatedAt: 1,
            }),
          ),
        );
        const insert = (
          left: Id<"concepts">,
          right: Id<"concepts">,
          updatedAt: number,
          evidence: Array<{
            claimId: Id<"claims">;
            stance: "supports";
            addedBy: "agent";
            addedAt: number;
          }> = [],
        ) =>
          ctx.db.insert("correspondences", {
            conceptAId: left,
            conceptBId: right,
            pairKey: pairKey(left, right),
            statement: "Test",
            rationaleMd: "Test",
            evidence,
            status: "conjectured",
            createdBy: "system",
            createdAt: updatedAt,
            updatedAt,
          });
        return [
          await insert(conceptIds[0]!, conceptIds[1]!, staleAt),
          await insert(conceptIds[2]!, conceptIds[3]!, freshAt),
          await insert(conceptIds[4]!, conceptIds[5]!, staleAt, [
            { claimId, stance: "supports", addedBy: "agent", addedAt: staleAt },
          ]),
        ];
      },
    );

    expect(
      await t.mutation(internal.correspondences.autoRetireStale, { now }),
    ).toEqual({ retired: 1, continued: false });
    const [stale, fresh, evidenced] = await t.run((ctx) =>
      Promise.all([
        ctx.db.get("correspondences", staleId),
        ctx.db.get("correspondences", freshId),
        ctx.db.get("correspondences", evidencedConjectureId),
      ]),
    );
    expect(stale?.status).toBe("retired");
    expect(stale?.statusReason).toBe("stale conjecture (auto)");
    expect(fresh?.status).toBe("conjectured");
    expect(evidenced?.status).toBe("conjectured");
  });

  test("schedules continuation so evidence-bearing rows cannot starve later stale conjectures", async () => {
    const t = convexTest(schema, modules);
    const now = 200 * 24 * 60 * 60 * 1000;
    const staleAt = now - AUTO_RETIRE_AFTER_MS - 1;
    const claimId = await seedClaim(t, 30);
    await t.run(async (ctx) => {
      const left = await ctx.db.insert("concepts", {
        name: "left",
        displayName: "left",
        aliases: [],
        domain: "left",
        domains: ["left"],
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const right = await ctx.db.insert("concepts", {
        name: "right",
        displayName: "right",
        aliases: [],
        domain: "right",
        domains: ["right"],
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      for (let index = 0; index < 500; index++) {
        await ctx.db.insert("correspondences", {
          conceptAId: left,
          conceptBId: right,
          pairKey: `evidenced-fixture-${index}`,
          statement: "Fixture",
          rationaleMd: "Fixture",
          evidence: [
            {
              claimId,
              stance: "supports",
              addedBy: "agent",
              addedAt: staleAt - 1,
            },
          ],
          status: "conjectured",
          createdBy: "system",
          createdAt: staleAt - 1,
          updatedAt: staleAt - 1,
        });
      }
      await ctx.db.insert("correspondences", {
        conceptAId: left,
        conceptBId: right,
        pairKey: "eligible-after-full-page",
        statement: "Fixture",
        rationaleMd: "Fixture",
        evidence: [],
        status: "conjectured",
        createdBy: "system",
        createdAt: staleAt,
        updatedAt: staleAt,
      });
    });

    expect(
      await t.mutation(internal.correspondences.autoRetireStale, { now }),
    ).toEqual({ retired: 0, continued: true });
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(2),
    );
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.name).toContain("correspondences:autoRetireStale");
  });
});
