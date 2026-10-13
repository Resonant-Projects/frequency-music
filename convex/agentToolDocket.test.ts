import { convexTest } from "convex-test";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { agentToolByName } from "./agentToolRegistry";
import { agentToolHttpHandlers } from "./agentToolsHttp";
import schema from "./schema";
import { agentToolArgs } from "./shared/agentToolArgs";
import { AGENT_TOOL_MANIFEST } from "./shared/agentToolManifest";
import { assertBoundedProposal } from "./shared/docketTools";

const proposal = {
  channel: "telegram",
  conversationId: "chat",
  messageRef: "voice",
  transcript: "Defer this for review",
};
const listening = {
  command: {
    action: "createListeningSession",
    target: { kind: "composition", id: "composition" },
    payload: {
      conditions: { listeningMethod: "headphones", timeOfDay: "evening" },
    },
  },
  proposal,
};
afterEach(() => vi.unstubAllEnvs());
describe("Wave 2 tool bindings", () => {
  test("registers only service proposals, without run provenance or signing operations", () => {
    expect(
      AGENT_TOOL_MANIFEST.filter((t) => t.kind === "service_proposal").map(
        (t) => t.name,
      ),
    ).toEqual(["proposeDecision", "proposeListening"]);
    for (const name of ["proposeDecision", "proposeListening"] as const) {
      expect(agentToolByName[name].langchain).toBe(false);
      expect(Object.keys(agentToolArgs[name].shape)).toEqual([
        "command",
        "proposal",
      ]);
    }
    expect(
      AGENT_TOOL_MANIFEST.some((t) =>
        /:(apply|cancel|confirm|createInternal)$/.test(t.backing),
      ),
    ).toBe(false);
    expect(agentToolArgs.proposeListening.safeParse(listening).success).toBe(
      true,
    );
    expect(agentToolArgs.proposeDecision.safeParse(listening).success).toBe(
      false,
    );
    expect(
      agentToolArgs.proposeListening.safeParse({
        ...listening,
        command: {
          action: "defer",
          target: listening.command.target,
          payload: {},
        },
      }).success,
    ).toBe(false);
    expect(() =>
      assertBoundedProposal({ command: { payload: { actor: "human" } } }),
    ).toThrow();
    expect(() =>
      assertBoundedProposal({ values: Array(101).fill("x") }),
    ).toThrow();
    expect(() => assertBoundedProposal({ text: "x".repeat(30001) })).toThrow();
  });
  test("uses exact backing functions and projects away signer and audio internals", async () => {
    const row = {
      _id: "card",
      kind: "pendingDraft",
      targetId: "draft",
      title: "Review",
      blurbMd: "Text",
      spokenBlurb: "",
      pageUrl: "/agent-drafts?draft=draft",
      decisions: ["reject"],
      contentHash: "a".repeat(64),
      audioUrl: "hidden",
      blurbArtifactId: "hidden",
    };
    const runMutation = vi.fn(async (..._args: unknown[]) => [row]);
    const runQuery = vi.fn(async (ref: never) =>
      getFunctionName(ref) === "docket:playbackForCard" ? null : row,
    );
    const ctx = { runMutation, runQuery } as never;
    const cards = await agentToolByName.listDocket.run(ctx, {});
    expect(getFunctionName(runMutation.mock.calls[0]![0]! as never)).toBe(
      "docket:list",
    );
    expect(cards).toEqual([
      {
        cardId: "card",
        ...Object.fromEntries(
          Object.entries(row).filter(
            ([k]) => !["_id", "audioUrl", "blurbArtifactId"].includes(k),
          ),
        ),
      },
    ]);
    await agentToolByName.getDocketCard.run(ctx, { cardId: "card" });
    expect(getFunctionName(runQuery.mock.calls[1]![0]! as never)).toBe(
      "docket:card",
    );
    runMutation.mockResolvedValue({
      _id: "intent",
      code: "D-1",
      status: "proposed",
      expiresAt: 100,
      signerCard: { chatId: "private" },
      signature: { userId: "private" },
      payloadDigest: "private",
    } as never);
    const result = await agentToolByName.proposeListening.run(ctx, listening);
    expect(getFunctionName(runMutation.mock.calls[1]![0]! as never)).toBe(
      "decisionIntents:proposeInternal",
    );
    expect(result).toEqual({
      intentId: "intent",
      code: "D-1",
      status: "proposed",
      expiresAt: 100,
      pageUrl: "/agent-drafts?intent=intent",
    });
    expect(
      agentToolArgs.recordDocketDelivery.safeParse({
        cardId: "card",
        channel: "telegram",
        contentHash: "a".repeat(64),
        phase: "posted",
      }).success,
    ).toBe(false);
    runMutation.mockResolvedValue({
      admitted: true,
      deliveryId: "receipt",
      updated: false,
    } as never);
    await agentToolByName.recordDocketDelivery.run(ctx, {
      cardId: "card",
      channel: "telegram",
      contentHash: "a".repeat(64),
      phase: "posting",
    });
    expect(getFunctionName(runMutation.mock.calls[2]![0]! as never)).toBe(
      "docket:recordDelivery",
    );
  });
  test("authenticates actual actions and creates only a proposal", async () => {
    vi.stubEnv("AGENT_TOOL_SECRET", "local-test-secret");
    const t = convexTest(schema, modules);
    const feedId = await t.run((ctx) =>
      ctx.db.insert("feeds", {
        name: "Example",
        url: "https://example.test/feed",
        type: "rss",
        enabled: false,
        metadata: {
          proposal: {
            agentRunId: "fixture-run",
            rationale: "Useful",
            sampleItems: [],
          },
        },
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const command = {
      action: "defer",
      target: { kind: "feedProposal", id: feedId },
      payload: {},
    };
    const ref = makeFunctionReference<"action">("agentTools:proposeDecision");
    await expect(
      t.action(ref, { agentSecret: "wrong", command, proposal }),
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query("decisionIntents").collect()),
    ).toEqual([]);
    const result = await t.action(ref, {
      agentSecret: "local-test-secret",
      command,
      proposal,
    });
    expect(result.status).toBe("proposed");
    expect(result.signature).toBeUndefined();
    const state = await t.run(async (ctx) => ({
      intents: await ctx.db.query("decisionIntents").collect(),
      sessions: await ctx.db.query("listeningSessions").collect(),
      feed: await ctx.db.get(feedId),
    }));
    expect(state.intents).toHaveLength(1);
    expect(state.sessions).toEqual([]);
    expect(state.feed?.enabled).toBe(false);
    expect(state.intents[0]?.signature).toBeUndefined();
    const compositionId = await seedComposition(t);
    await t.action(
      makeFunctionReference<"action">("agentTools:proposeListening"),
      {
        agentSecret: "local-test-secret",
        ...listening,
        command: {
          ...listening.command,
          target: { kind: "composition", id: compositionId },
        },
      },
    );
    expect(
      await t.run((ctx) => ctx.db.query("listeningSessions").collect()),
    ).toEqual([]);
    const listeningIntent = await t.run((ctx) =>
      ctx.db
        .query("decisionIntents")
        .filter((q) => q.eq(q.field("action"), "createListeningSession"))
        .unique(),
    );
    expect(listeningIntent?.payload).toEqual(listening.command.payload);
    expect(listeningIntent?.signature).toBeUndefined();
    const runAction = vi.fn();
    const response = await (
      agentToolHttpHandlers.proposeDecision as unknown as {
        _handler: (ctx: unknown, request: Request) => Promise<Response>;
      }
    )._handler(
      { runAction } as never,
      new Request("https://local.test", {
        method: "POST",
        body: JSON.stringify({ secret: "wrong", command, proposal }),
      }),
    );
    expect(response.status).toBe(403);
    expect(runAction).not.toHaveBeenCalled();
  });
});

async function seedComposition(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const hypothesisId = await ctx.db.insert("hypotheses", {
      title: "Hypothesis",
      question: "Question",
      hypothesis: "Statement",
      rationaleMd: "Rationale",
      concepts: [],
      sourceIds: [],
      extractionIds: [],
      status: "draft",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    const recipeId = await ctx.db.insert("recipes", {
      hypothesisId,
      title: "Recipe",
      whyThisMatters: "Makes it testable",
      bodyMd: "Protocol",
      parameters: [],
      dawChecklist: [],
      status: "draft",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    return await ctx.db.insert("compositions", {
      recipeId,
      title: "Composition",
      artifactType: "microStudy",
      version: "v1",
      status: "rendered",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
  });
}
