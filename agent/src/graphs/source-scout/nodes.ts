import { z } from "zod";
import type {
  ScoutJudgment,
  ScoutQuery,
  ScoutSearchHit,
  ScoutTargets,
  ScoutWriteResult,
  SourceScoutState,
  SourceScoutUpdate,
} from "../../state/sourceScoutState.js";
import {
  createWebSearch,
  type WebSearchInput,
  type WebSearchResult,
} from "../../tools/searchTool.js";
import { callConvex } from "../../tools/convexTools.js";
import { resolveCurrentTraceUrl } from "../../tracing/currentTrace.js";
import {
  appendRemoteAuditEvent,
  finalizeRunCompleted,
  type AgentAuditEvent,
  type ToolCaller,
} from "../shared/audit.js";
import {
  createStructuredJudge,
  invokeJudgeOrError,
  type StructuredJudge,
} from "../shared/judge.js";
import {
  MAX_INGESTS_PER_RUN,
  MAX_RESULTS_PER_SEARCH,
  MAX_SEARCH_CALLS,
} from "./config.js";
import {
  queryPlanningPrompt,
  resultJudgePrompt,
  targetGapLabels,
} from "./prompts.js";

const scoutQuerySchema = z.object({
  query: z.string().trim().min(1),
  targetGap: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
});

export const queryPlanOutputSchema = z.object({
  queries: z.array(scoutQuerySchema).max(MAX_SEARCH_CALLS),
});

export const scoutVerdictSchema = z.object({
  kind: z.enum(["source", "feed", "discard"]),
  relevanceNote: z.string().trim().min(1),
  targetGap: z.string().trim().min(1),
  evidenceLevelGuess: z.string().trim().min(1).optional(),
});

type QueryPlan = z.infer<typeof queryPlanOutputSchema>;
type QueryPlanner = StructuredJudge<QueryPlan>;
type ScoutJudge = StructuredJudge<z.infer<typeof scoutVerdictSchema>>;
type WebSearch = (
  input: WebSearchInput,
  context?: { agentRunId?: string; targetGap?: string },
) => Promise<WebSearchResult[]>;

function asTargets(value: unknown): ScoutTargets {
  if (!value || typeof value !== "object") {
    return { thinDomains: [], starvedConjectures: [] };
  }
  const candidate = value as Partial<ScoutTargets>;
  return {
    thinDomains: Array.isArray(candidate.thinDomains)
      ? candidate.thinDomains
      : [],
    starvedConjectures: Array.isArray(candidate.starvedConjectures)
      ? candidate.starvedConjectures
      : [],
  };
}

export function createFetchTargetsNode(callTool: ToolCaller = callConvex) {
  return async (state: { agentRunId?: string }): Promise<SourceScoutUpdate> => {
    const targets = asTargets(await callTool("getScoutTargets", {}));
    const auditEvents = await appendRemoteAuditEvent(
      callTool,
      state.agentRunId,
      "tool_call",
      "Fetched source-scout gap census",
      {
        thinDomains: targets.thinDomains.length,
        starvedConjectures: targets.starvedConjectures.length,
      },
    );
    return { targets, auditEvents };
  };
}

export const fetchTargetsNode = createFetchTargetsNode();

export function routeAfterTargets(state: Pick<SourceScoutState, "targets">) {
  const count =
    (state.targets?.thinDomains.length ?? 0) +
    (state.targets?.starvedConjectures.length ?? 0);
  return count === 0 ? "summarize" : "plan_queries";
}

export function createPlanQueriesNode(
  dependencies: { planner?: QueryPlanner; callTool?: ToolCaller } = {},
) {
  const callTool = dependencies.callTool ?? callConvex;
  const planner =
    dependencies.planner ?? createStructuredJudge(queryPlanOutputSchema);
  return async (state: {
    agentRunId?: string;
    traceUrl?: string;
    targets?: ScoutTargets;
  }): Promise<SourceScoutUpdate> => {
    const targets = state.targets ?? {
      thinDomains: [],
      starvedConjectures: [],
    };
    const planned = await invokeJudgeOrError({
      judge: planner,
      prompt: queryPlanningPrompt(targets),
      callTool,
      agentRunId: state.agentRunId,
      traceUrl: state.traceUrl,
      errorEventMessage: "Source scout could not plan search queries",
      errorEventPayload: (message) => ({ reason: "planner_error", message }),
    });
    if (planned.judgeError) {
      return {
        plannedQueries: [],
        plannerErrorCount: 1,
        auditEvents: planned.auditEvents,
      };
    }
    const allowedGaps = new Set(targetGapLabels(targets));
    const plannedQueries = planned.verdict.queries
      .filter((query) => allowedGaps.has(query.targetGap))
      .slice(0, MAX_SEARCH_CALLS);
    const auditEvents = [
      ...planned.auditEvents,
      ...(await appendRemoteAuditEvent(
        callTool,
        state.agentRunId,
        "decision",
        "Planned need-directed source-scout queries",
        {
          planned: plannedQueries.length,
          rejectedUnknownGaps:
            planned.verdict.queries.length - plannedQueries.length,
          targetGaps: plannedQueries.map((query) => query.targetGap),
        },
      )),
    ];
    return { plannedQueries, auditEvents };
  };
}

export async function planQueriesNode(
  state: SourceScoutState,
): Promise<SourceScoutUpdate> {
  return await createPlanQueriesNode()(state);
}

export function routeAfterQueries(
  state: Pick<SourceScoutState, "plannedQueries">,
) {
  return state.plannedQueries.length === 0 ? "summarize" : "search_loop";
}

export function createSearchLoopNode(search: WebSearch = createWebSearch()) {
  return async (state: {
    agentRunId?: string;
    plannedQueries: ScoutQuery[];
  }): Promise<SourceScoutUpdate> => {
    const searchHits: ScoutSearchHit[] = [];
    for (const query of state.plannedQueries.slice(0, MAX_SEARCH_CALLS)) {
      const results = await search(
        { query: query.query, maxResults: MAX_RESULTS_PER_SEARCH },
        { agentRunId: state.agentRunId, targetGap: query.targetGap },
      );
      for (const result of results) searchHits.push({ query, result });
    }
    return { searchHits };
  };
}

export async function searchLoopNode(
  state: SourceScoutState,
): Promise<SourceScoutUpdate> {
  return await createSearchLoopNode()(state);
}

export function createJudgeResultsNode(
  dependencies: {
    judge?: ScoutJudge;
    callTool?: ToolCaller;
    resolveTraceUrl?: typeof resolveCurrentTraceUrl;
  } = {},
) {
  const callTool = dependencies.callTool ?? callConvex;
  const judge = dependencies.judge ?? createStructuredJudge(scoutVerdictSchema);
  const resolveTraceUrl =
    dependencies.resolveTraceUrl ?? resolveCurrentTraceUrl;
  return async (state: {
    agentRunId?: string;
    traceUrl?: string;
    searchHits: ScoutSearchHit[];
  }): Promise<SourceScoutUpdate> => {
    const judgments: ScoutJudgment[] = [];
    const auditEvents: AgentAuditEvent[] = [];
    let judgeErrorCount = 0;
    for (const searchHit of state.searchHits) {
      const judged = await invokeJudgeOrError({
        judge,
        prompt: resultJudgePrompt(searchHit),
        callTool,
        agentRunId: state.agentRunId,
        traceUrl: state.traceUrl,
        errorEventMessage:
          "Source scout discarded search result after judge error",
        errorEventPayload: (message) => ({
          url: searchHit.result.url,
          targetGap: searchHit.query.targetGap,
          reason: "judge_error",
          message,
        }),
      });
      auditEvents.push(...judged.auditEvents);
      if (judged.judgeError) {
        judgeErrorCount += 1;
        judgments.push({ searchHit, discardReason: judged.judgeError });
        continue;
      }
      const verdict = {
        ...judged.verdict,
        targetGap: searchHit.query.targetGap,
      };
      judgments.push({ searchHit, verdict });
      auditEvents.push(
        ...(await appendRemoteAuditEvent(
          callTool,
          state.agentRunId,
          "decision",
          "Source scout judged search result",
          {
            url: searchHit.result.url,
            kind: verdict.kind,
            relevanceNote: verdict.relevanceNote,
            targetGap: verdict.targetGap,
          },
        )),
      );
    }
    return {
      judgments,
      judgeErrorCount,
      auditEvents,
      traceUrl: await resolveTraceUrl(state.traceUrl),
    };
  };
}

export async function judgeResultsNode(
  state: SourceScoutState,
): Promise<SourceScoutUpdate> {
  return await createJudgeResultsNode()(state);
}

function rationaleFor(judgment: Extract<ScoutJudgment, { verdict: object }>) {
  return `${judgment.verdict.relevanceNote} Gap: ${judgment.verdict.targetGap}`;
}

function parsedPublishedAt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function createIngestSourcesNode(callTool: ToolCaller = callConvex) {
  return async (state: {
    agentRunId?: string;
    judgments: ScoutJudgment[];
  }): Promise<SourceScoutUpdate> => {
    if (!state.agentRunId)
      throw new Error("source-scout requires agentRunId provenance");
    const sourceWrites: ScoutWriteResult[] = [];
    const auditEvents: AgentAuditEvent[] = [];
    const seenUrls = new Set<string>();
    const candidates = state.judgments
      .filter(
        (judgment): judgment is Extract<ScoutJudgment, { verdict: object }> =>
          judgment.verdict?.kind === "source",
      )
      .filter((judgment) => {
        const url = judgment.searchHit.result.url;
        if (seenUrls.has(url)) return false;
        seenUrls.add(url);
        return true;
      })
      .slice(0, MAX_INGESTS_PER_RUN);
    for (const judgment of candidates) {
      const rationale = rationaleFor(judgment);
      const publishedAt = parsedPublishedAt(
        judgment.searchHit.result.publishedAt,
      );
      const result = (await callTool("ingestScoutedSource", {
        url: judgment.searchHit.result.url,
        title: judgment.searchHit.result.title,
        ...(publishedAt === undefined ? {} : { publishedAt }),
        query: judgment.searchHit.query.query,
        rationale,
        agentRunId: state.agentRunId,
      })) as { id?: unknown; created?: unknown };
      if (typeof result.id !== "string") {
        throw new Error("ingestScoutedSource returned no source id");
      }
      const write = {
        id: result.id,
        url: judgment.searchHit.result.url,
        title: judgment.searchHit.result.title,
        targetGap: judgment.verdict.targetGap,
        rationale,
        created: result.created === true,
      };
      sourceWrites.push(write);
      auditEvents.push(
        ...(await appendRemoteAuditEvent(
          callTool,
          state.agentRunId,
          write.created ? "tool_call" : "decision",
          write.created
            ? "Source scout ingested candidate source"
            : "Source scout skipped duplicate source",
          { ...write, query: judgment.searchHit.query.query },
        )),
      );
    }
    return { sourceWrites, auditEvents };
  };
}

export const ingestSourcesNode = createIngestSourcesNode();

function feedType(url: string): "rss" | "podcast" | "youtube" {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname === "youtu.be"
    )
      return "youtube";
    if (/podcast|audio/i.test(parsed.pathname)) return "podcast";
  } catch {
    // The tool schema rejects invalid URLs; default only keeps this helper total.
  }
  return "rss";
}

export function createProposeFeedsNode(callTool: ToolCaller = callConvex) {
  return async (state: {
    agentRunId?: string;
    judgments: ScoutJudgment[];
  }): Promise<SourceScoutUpdate> => {
    if (!state.agentRunId)
      throw new Error("source-scout requires agentRunId provenance");
    const feedWrites: ScoutWriteResult[] = [];
    const auditEvents: AgentAuditEvent[] = [];
    const seenUrls = new Set<string>();
    for (const judgment of state.judgments) {
      if (!judgment.verdict || judgment.verdict.kind !== "feed") continue;
      const url = judgment.searchHit.result.url;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      const rationale = rationaleFor(judgment);
      const result = (await callTool("proposeFeed", {
        name: judgment.searchHit.result.title,
        url,
        type: feedType(url),
        rationale,
        sampleItems: [judgment.searchHit.result],
        agentRunId: state.agentRunId,
      })) as { id?: unknown; created?: unknown };
      if (typeof result.id !== "string") {
        throw new Error("proposeFeed returned no feed id");
      }
      const write = {
        id: result.id,
        url,
        title: judgment.searchHit.result.title,
        targetGap: judgment.verdict.targetGap,
        rationale,
        created: result.created === true,
      };
      feedWrites.push(write);
      auditEvents.push(
        ...(await appendRemoteAuditEvent(
          callTool,
          state.agentRunId,
          write.created ? "tool_call" : "decision",
          write.created
            ? "Source scout proposed disabled feed"
            : "Source scout skipped duplicate feed",
          write,
        )),
      );
    }
    return { feedWrites, auditEvents };
  };
}

export const proposeFeedsNode = createProposeFeedsNode();

export function createSummarizeNode(callTool: ToolCaller = callConvex) {
  return async (state: SourceScoutState): Promise<SourceScoutUpdate> => {
    const gapCount =
      (state.targets?.thinDomains.length ?? 0) +
      (state.targets?.starvedConjectures.length ?? 0);
    const sourcesCreated = state.sourceWrites.filter(
      (write) => write.created,
    ).length;
    const feedsCreated = state.feedWrites.filter(
      (write) => write.created,
    ).length;
    const duplicates =
      state.sourceWrites.length +
      state.feedWrites.length -
      sourcesCreated -
      feedsCreated;
    const rationales = [...state.sourceWrites, ...state.feedWrites]
      .map((write) => `${write.title}: ${write.rationale}`)
      .join(" | ");
    const summary =
      gapCount === 0
        ? "source-scout completed: no research gaps"
        : `source-scout completed: ${sourcesCreated} sources ingested, ${feedsCreated} feeds proposed, ${duplicates} duplicates skipped, ${state.judgeErrorCount} judge errors${rationales ? `. Rationale: ${rationales}` : ""}`;
    const auditEvents = await finalizeRunCompleted(
      callTool,
      state.agentRunId,
      summary,
      state.traceUrl,
    );
    return { summary, auditEvents };
  };
}

export const summarizeNode = createSummarizeNode();
