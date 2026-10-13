import { once } from "node:events";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { internal } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import { modules } from "../../../harness/modules";
import { HOUSE_VOICE_KEY, writeSetting } from "../../../convex/settings";
import { DOCKET_PROMPT_VERSION } from "../../../convex/shared/docket";
import { createWave2Operations } from "../../src/mcp/backend";
import { createMcpHttpServer } from "../../src/mcp/server";

afterEach(() => vi.unstubAllEnvs());
async function fixture() {
  vi.stubEnv("DOCKET_PREPARATION_ENABLED", "false");
  vi.stubEnv("AGENT_TOOL_SECRET", "test-outbound");
  const t = convexTest(schema, modules);
  const draftId = await t.run(async (ctx) => {
    const runId = await ctx.db.insert("agentRuns", {
      graphName: "test",
      status: "needs_review",
      input: null,
      createdAt: 1,
      updatedAt: 1,
    });
    await writeSetting(ctx, HOUSE_VOICE_KEY, "inworld-max");
    return ctx.db.insert("agentReviewDrafts", {
      agentRunId: runId,
      graphName: "test",
      kind: "hypothesis_draft",
      title: "Draft",
      summary: "Review this draft",
      candidateIds: [],
      status: "pending_review",
      createdBy: "agent",
      createdAt: 1,
      updatedAt: 1,
    });
  });
  const [card] = await t.mutation(internal.docket.list, {});
  if (!card) throw new Error("Missing fixture card");
  const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
    input: {
      kind: "narrate",
      script: { paragraphs: ["Current narration"], chapters: [] },
      voiceId: "inworld-max",
      promptVersion: `${DOCKET_PROMPT_VERSION}:${card.contentHash}`,
      target: "spoken",
      title: "Narration",
      access: "private",
      refs: { docketCardId: card._id },
      assembleOnDone: false,
      rendererVersion: "test",
    },
  });
  const artifactId = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob(["local fixture audio"]),
    );
    const artifactId = await ctx.db.insert("audioArtifacts", {
      kind: "narration",
      role: "delivery",
      status: "ready",
      storageId,
      mimeType: "audio/mpeg",
      metadataStripped: true,
      encoding: { codec: "mp3", sampleRate: 48000, channels: 2 },
      normalization: "applied",
      access: "private",
      title: "Narration",
      refs: { docketCardId: card._id, mediaJobId: jobId },
      contentHash: "audio",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.patch(jobId, {
      status: "done",
      resultArtifactIds: [artifactId],
    });
    await ctx.db.patch(card._id, {
      spokenBlurb: "Current narration",
      blurbArtifactId: artifactId,
    });
    return artifactId;
  });
  const operations = createWave2Operations();
  operations["docket.list"].invoke = (args) =>
    t.action(makeFunctionReference<"action">("agentTools:listDocket"), {
      agentSecret: "test-outbound",
      ...args,
    });
  operations["docket.card"].invoke = (args) =>
    t.action(makeFunctionReference<"action">("agentTools:getDocketCard"), {
      agentSecret: "test-outbound",
      ...args,
    });
  const server = createMcpHttpServer({
    inboundSecret: "test-inbound",
    outboundSecret: "test-outbound",
    operations,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  const call = async (name: string, args = {}) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "x-mcp-secret": "test-inbound",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    const body = await response.json();
    expect(body.error).toBeUndefined();
    expect(body.result.isError).toBeUndefined();
    return JSON.parse(body.result.content[0].text);
  };
  const close = async () => {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  };
  return { t, card, draftId, artifactId, jobId, call, close };
}

test.each([
  "ready",
  "stale",
  "hidden",
  "dangling",
  "voiceChanged",
  "pending",
  "wrongJobVersion",
  "wrongScript",
  "jobNotDone",
  "noStorage",
  "notJobResult",
])(
  "MCP and authenticated registry expose only current safe narration: %s",
  async (state) => {
    const { t, card, draftId, artifactId, jobId, call, close } =
      await fixture();
    try {
      await t.run(async (ctx) => {
        if (state === "stale")
          await ctx.db.patch(draftId, { summary: "Changed source" });
        if (state === "voiceChanged")
          await writeSetting(ctx, HOUSE_VOICE_KEY, "gemini-kore");
        if (state === "pending")
          await ctx.db.patch(artifactId, { status: "pending" });
        if (state === "noStorage")
          await ctx.db.patch(artifactId, { storageId: undefined });
        if (state === "notJobResult")
          await ctx.db.patch(jobId, { resultArtifactIds: [] });
        if (state === "jobNotDone")
          await ctx.db.patch(jobId, { status: "claimed" });
        if (state === "wrongJobVersion" || state === "wrongScript") {
          const job = (await ctx.db.get(jobId))!;
          if (job.input.kind !== "narrate")
            throw new Error("Expected narration");
          await ctx.db.patch(jobId, {
            input: {
              ...job.input,
              ...(state === "wrongJobVersion"
                ? { promptVersion: "old" }
                : { script: { paragraphs: ["Old narration"], chapters: [] } }),
            },
          });
        }
        if (state === "hidden" || state === "dangling") {
          const groupId = await ctx.db.insert("blindGroups", {
            purpose: "voiceShootout",
            members: [{ memberId: "A", artifactId, label: "Take A" }],
            requiredRatings: ["overall"],
            createdAt: 1,
          });
          // Hidden tests reverse membership with NO artifact back-reference.
          if (state === "dangling") {
            await ctx.db.patch(artifactId, { blindGroupId: groupId });
            await ctx.db.delete(groupId);
          }
        }
      });
      // Query first, so stale audio is rejected even before list reconciliation.
      const single = await call("docket.card", { cardId: card._id });
      const [listed] = await call("docket.list");
      for (const result of [single, listed]) {
        expect(result.cardId).toBe(card._id);
        expect(result.blurbArtifactId).toBeUndefined();
        expect(result.storageId).toBeUndefined();
        if (state === "ready") {
          const playback = await t.query(
            internal.audioArtifacts.playbackInternal,
            { artifactId },
          );
          expect(result.audioUrl).toBe(playback?.url);
          expect(result.audioUrl).toMatch(/^https?:\/\//);
        } else expect(result.audioUrl).toBeUndefined();
      }
      expect(
        await t.run((ctx) => ctx.db.query("listeningSessions").collect()),
      ).toEqual([]);
    } finally {
      await close();
    }
  },
);
