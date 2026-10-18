import { HumanMessage } from "@langchain/core/messages";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { z } from "zod";
import { RESEARCH_SOURCE_GUIDANCE } from "../../convex/shared/researchTopics.js";
import { createJudgeStanceNode } from "../src/graphs/evidence-hunter/nodes.js";
import { stanceJudgePrompt } from "../src/graphs/evidence-hunter/prompts.js";
import { createTournamentModel } from "../src/graphs/hypothesis-tournament/model.js";
import { tournamentPrompt } from "../src/graphs/hypothesis-tournament/prompts.js";
import type {
  ModelRequest,
  TournamentCandidate,
} from "../src/graphs/hypothesis-tournament/types.js";
import {
  createStructuredJudge,
  invokeJudgeOrError,
} from "../src/graphs/shared/judge.js";
import { createJudgeResultsNode } from "../src/graphs/source-scout/nodes.js";
import { resultJudgePrompt } from "../src/graphs/source-scout/prompts.js";
import {
  type CachedPrompt,
  cachedPrompt,
  type ModelPrompt,
  promptText,
  toModelInput,
} from "../src/models/promptCache.js";
import type {
  EvidenceTarget,
  SemanticClaim,
} from "../src/state/evidenceHunterState.js";
import type { ScoutSearchHit } from "../src/state/sourceScoutState.js";

function asCached(prompt: ModelPrompt): CachedPrompt {
  if (typeof prompt === "string") throw new Error("expected a cached prompt");
  return prompt;
}

describe("prompt cache helper", () => {
  test("a string passes through with no breakpoint", () => {
    expect(toModelInput("plain")).toBe("plain");
    expect(promptText("plain")).toBe("plain");
  });

  test("a cached prompt marks only its shared block", () => {
    const [message] = toModelInput(cachedPrompt("shared ", "rest")) as [
      HumanMessage,
    ];
    expect(message).toBeInstanceOf(HumanMessage);
    expect(message.content).toEqual([
      { type: "text", text: "shared ", cache_control: { type: "ephemeral" } },
      { type: "text", text: "rest" },
    ]);
    expect(promptText(cachedPrompt("shared ", "rest"))).toBe("shared rest");
  });

  test("an empty part is rejected", () => {
    expect(() => cachedPrompt("", "rest")).toThrow();
    expect(() => cachedPrompt("shared", "")).toThrow();
  });
});

const target = {
  correspondenceId: "c1",
  statement: "Beating rates near 4 Hz read as tension",
  conceptA: { displayName: "Beating", description: "Interference" },
  conceptB: { displayName: "Tension", description: "Arousal" },
} as unknown as EvidenceTarget;
const claim = (id: string) =>
  ({ claimId: id, text: `Claim ${id}` }) as unknown as SemanticClaim;

// The prompt text before this change; the split must not alter it.
const legacyStancePrompt = (t: EvidenceTarget, c: SemanticClaim) =>
  `You are evaluating evidence for a Frequency Music cross-domain correspondence.

Classify the claim as supports, contradicts, or irrelevant to the correspondence as written. "Supports" requires the claim to supply a premise or observation that increases confidence. "Contradicts" requires tension with a premise or prediction. Shared topic or vocabulary is irrelevant. Give a short grounded note and do not infer beyond the claim text.

Correspondence:
${JSON.stringify(t, null, 2)}

Candidate claim:
${JSON.stringify(c, null, 2)}`;

const hit = (url: string, gap: string): ScoutSearchHit =>
  ({
    query: { query: "q", targetGap: gap, rationale: "why" },
    result: { url, title: "T", providerUrl: "https://provider" },
  }) as unknown as ScoutSearchHit;

const legacyResultPrompt = (h: ScoutSearchHit) =>
  `You judge a web-search result for Frequency Music need-directed source discovery.

Classify it as:
- source: a relevant individual research input worth canonical intake;
- feed: a relevant recurring RSS, podcast, journal feed, or YouTube channel feed worth proposing for human enablement;
- discard: generic sound/music content, generic ML content, weakly related content, duplicates in spirit, or anything that does not address the motivating gap.

${RESEARCH_SOURCE_GUIDANCE}

Accept a useful foundational or contrary source even if it is not a new journal paper. Require a substantive individual work or chapter; a book index is a discovery aid. Prefer accessible full text and give abstract-only or uncertain access an explicit note. Judge relevance from the supplied metadata only; search snippets and retrieval scores are not evidence of the paper's claims. Do not reject a counterexample because it disagrees with the project's current ideas.

The targetGap must repeat the exact motivating gap shown below. Give a short grounded relevanceNote. evidenceLevelGuess is optional and must remain a guess based only on the result metadata.

Motivating gap: ${h.query.targetGap}
Query rationale: ${h.query.rationale}
Search result:
${JSON.stringify({ ...h.result, providerUrl: undefined }, null, 2)}`;

describe("judge prompts keep their text and share a prefix", () => {
  test("evidence-hunter claims for one target share the target prefix", () => {
    const first = asCached(stanceJudgePrompt(target, claim("a"), true));
    const second = asCached(stanceJudgePrompt(target, claim("b"), true));
    expect(promptText(first)).toBe(legacyStancePrompt(target, claim("a")));
    expect(second.shared).toBe(first.shared);
    expect(first.shared).toContain(target.statement);
    expect(first.rest.startsWith("Candidate claim:")).toBe(true);
  });

  test("source-scout results share the instruction prefix", () => {
    const first = asCached(
      resultJudgePrompt(hit("https://a", "gap one"), true),
    );
    const second = asCached(
      resultJudgePrompt(hit("https://b", "gap two"), true),
    );
    expect(promptText(first)).toBe(
      legacyResultPrompt(hit("https://a", "gap one")),
    );
    expect(second.shared).toBe(first.shared);
    expect(first.shared).not.toContain("gap one");
    expect(first.rest.startsWith("Motivating gap:")).toBe(true);
  });

  test("a single call gets the plain text with no breakpoint", () => {
    expect(stanceJudgePrompt(target, claim("a"))).toBe(
      legacyStancePrompt(target, claim("a")),
    );
    expect(resultJudgePrompt(hit("https://a", "gap one"))).toBe(
      legacyResultPrompt(hit("https://a", "gap one")),
    );
  });
});

const seed = { family: "hint" as const, refs: [], context: "Slow beating" };
const candidate = (batchIndex: number): TournamentCandidate =>
  ({
    agentRunId: "run",
    batchIndex,
    seedFamily: "hint",
    seedRefs: [],
    payload: {
      title: `t${batchIndex}`,
      question: "q",
      statement: `s${batchIndex}`,
      rationale: "r",
      whyThisMatters: "w",
      sourceIds: [],
      extractionIds: [],
    },
    evidenceClaimIds: [],
    evidence: [],
    statementEmbedding: [0.123456789],
    relations: [],
    scores: [],
    outcome: "finalist",
    flags: [],
    createdAt: 1,
  }) as TournamentCandidate;

// The prompt text before this change.
function legacyTournamentText(request: ModelRequest) {
  const head = promptText(tournamentPrompt(request)).split("\n\n")[0]!;
  return `${head}\n\n${JSON.stringify(
    request,
    (key, value) =>
      key === "statementEmbedding" || key === "agentRunId" ? undefined : value,
    2,
  )}`;
}

describe("graph loops mark only repeated prefixes", () => {
  const promptKinds = (invoke: ReturnType<typeof vi.fn>) =>
    invoke.mock.calls.map(([prompt]) => typeof prompt);
  const node = {
    callTool: vi.fn(async () => ({ ok: true })),
    resolveTraceUrl: async (traceUrl?: string) => traceUrl,
  };

  test("evidence hunter marks a target only when it has several claims", async () => {
    const invoke = vi.fn(async () => ({
      stance: "irrelevant" as const,
      note: "n",
    }));
    await createJudgeStanceNode({ ...node, judge: { invoke } })({
      searches: [
        { target, claims: [claim("a"), claim("b")] },
        { target, claims: [claim("c")] },
      ],
    } as never);
    expect(promptKinds(invoke)).toEqual(["object", "object", "string"]);
  });

  test("source scout marks results only when it judges several", async () => {
    const invoke = vi.fn(async () => ({
      kind: "discard" as const,
      relevanceNote: "n",
      targetGap: "gap",
    }));
    const judge = createJudgeResultsNode({ ...node, judge: { invoke } });
    await judge({ searchHits: [hit("https://a", "gap")] });
    await judge({
      searchHits: [hit("https://a", "gap"), hit("https://b", "gap")],
    });
    expect(promptKinds(invoke)).toEqual(["string", "object", "object"]);
  });
});

describe("tournament prompts", () => {
  const scoring = (judgeIndex: number): ModelRequest => ({
    kind: "scoring",
    candidate: { ...candidate(0), scores: [] },
    seed,
    judgeIndex,
  });

  test("the three scoring judges differ only after the breakpoint", () => {
    const prompts = [0, 1, 2].map((i) =>
      asCached(tournamentPrompt(scoring(i))),
    );
    for (const [i, prompt] of prompts.entries()) {
      expect(prompt.shared).toBe(prompts[0]!.shared);
      expect(prompt.rest).toBe(`,\n  "judgeIndex": ${i}\n}`);
      expect(promptText(prompt)).toBe(legacyTournamentText(scoring(i)));
      expect(promptText(prompt)).not.toContain("0.123456789");
      expect(promptText(prompt)).not.toContain("agentRunId");
    }
  });

  test("single-call kinds carry no breakpoint", () => {
    expect(typeof tournamentPrompt({ kind: "generation", seed })).toBe(
      "string",
    );
    expect(
      typeof tournamentPrompt({
        kind: "selfCheck",
        candidate: candidate(0),
        seed,
      }),
    ).toBe("string");
    const finalist: ModelRequest = {
      kind: "finalist",
      left: candidate(0),
      right: candidate(1),
    };
    expect(tournamentPrompt(finalist)).toBe(legacyTournamentText(finalist));
  });
});

describe("cache_control reaches the Anthropic request body", () => {
  const anthropicResponse = (text: string) =>
    Response.json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-5-5",
      content: [{ type: "text", text }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        cache_creation_input_tokens: 700,
        cache_read_input_tokens: 1400,
        output_tokens: 5,
      },
    });

  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-only");
    vi.stubEnv("ANTHROPIC_API_URL", undefined);
    vi.stubEnv("OPENROUTER_API_KEY", undefined);
    vi.stubEnv("CODEX_ENABLED", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const sentMessage = (fetch: ReturnType<typeof vi.fn>) => {
    const [url, init] = fetch.mock.calls[0]! as [string, RequestInit];
    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(init.body as string);
    expect(body.output_config.format).toMatchObject({ type: "json_schema" });
    return body.messages as Array<{ role: string; content: unknown }>;
  };

  test("the structured judge sends the breakpoint through invokeJudgeOrError", async () => {
    const fetch = vi.fn(async () => anthropicResponse('{"accept":true}'));
    vi.stubGlobal("fetch", fetch);
    const callTool = vi.fn();
    const result = await invokeJudgeOrError({
      judge: createStructuredJudge(z.object({ accept: z.boolean() })),
      prompt: cachedPrompt("shared instructions ", "per-call item"),
      callTool,
      agentRunId: "run",
      errorEventMessage: "judge failed",
      errorEventPayload: (message) => ({ message }),
    });
    expect(result).toEqual({ verdict: { accept: true }, auditEvents: [] });
    expect(callTool).not.toHaveBeenCalled();
    expect(sentMessage(fetch)).toEqual([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "shared instructions ",
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: "per-call item" },
        ],
      },
    ]);
  });

  test("a string judge prompt sends no breakpoint", async () => {
    const fetch = vi.fn(async () => anthropicResponse('{"accept":true}'));
    vi.stubGlobal("fetch", fetch);
    await createStructuredJudge(z.object({ accept: z.boolean() })).invoke(
      "plain prompt",
      { configurable: {} },
    );
    expect(JSON.stringify(sentMessage(fetch))).not.toContain("cache_control");
  });

  test("tournament scoring sends the breakpoint and counts cache tokens", async () => {
    const fetch = vi.fn(async () =>
      anthropicResponse('{"stake":4,"novelty":3,"falsifiability":5}'),
    );
    vi.stubGlobal("fetch", fetch);
    const request: ModelRequest = {
      kind: "scoring",
      candidate: candidate(0),
      seed,
      judgeIndex: 1,
    };
    const result = await createTournamentModel()(request, {
      signal: new AbortController().signal,
      maxTotalTokens: 300_000,
    });
    // Cache writes and reads count at face value against the run budget.
    expect(result).toEqual({
      ok: true,
      value: { stake: 4, novelty: 3, falsifiability: 5 },
      totalTokens: 10 + 700 + 1400 + 5,
    });
    const prompt = asCached(tournamentPrompt(request));
    const [message] = sentMessage(fetch);
    expect(message!.content).toEqual([
      {
        type: "text",
        text: prompt.shared,
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: prompt.rest },
    ]);
  });
});
