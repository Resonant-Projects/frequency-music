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
import {
  createCrawlPage,
  type CrawledPage,
  type PageHint,
} from "../../tools/crawlTool.js";
import { callConvex } from "../../tools/convexTools.js";
import { redactError } from "../../shared/redactError.js";
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
  MAX_FEED_PROPOSALS_PER_RUN,
  MAX_INGESTS_PER_RUN,
  MAX_BACKLOG_PAGES,
  MAX_RECAPTURES_PER_RUN,
  MAX_RESULTS_PER_SEARCH,
  MAX_SEARCH_CALLS,
  RECAPTURE_CONCURRENCY,
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

// Maps each already-ingested URL to whether its Source still awaits capture.
async function existingSourceUrls(
  callTool: ToolCaller,
  urls: string[],
): Promise<Map<string, boolean>> {
  if (urls.length === 0) return new Map();
  try {
    const result = await callTool("findExistingSourceUrls", { urls });
    return new Map(
      (Array.isArray(result) ? result : []).flatMap(
        (entry): Array<[string, boolean]> => {
          const { url, needsText } = (entry ?? {}) as Record<string, unknown>;
          return typeof url === "string" ? [[url, needsText === true]] : [];
        },
      ),
    );
  } catch (error) {
    // The preflight only saves crawler work; intake still dedupes canonically.
    console.warn(
      "[source-scout] Existing-source preflight failed; crawling all candidates:",
      redactError(error),
    );
    return new Map();
  }
}

export function createIngestSourcesNode(
  callTool: ToolCaller = callConvex,
  crawl: (
    url: string,
    hint?: PageHint,
  ) => Promise<CrawledPage | null> = createCrawlPage(),
) {
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
    const known = await existingSourceUrls(callTool, [
      ...new Set(
        candidates.flatMap(({ searchHit: { result } }) =>
          result.providerUrl ? [result.url, result.providerUrl] : [result.url],
        ),
      ),
    ]);
    // Intake keys the URL verbatim. When a Source already exists under the
    // provider's original spelling, ingest that spelling so it dedupes.
    const intakeUrls = candidates.map(({ searchHit: { result } }) =>
      !known.has(result.url) &&
      result.providerUrl &&
      known.has(result.providerUrl)
        ? result.providerUrl
        : result.url,
    );
    // Duplicate intake stores text only for a scout URL-only Source whose
    // earlier capture failed, so every other known URL skips the crawl.
    const pages = await Promise.all(
      intakeUrls.map((url, index) =>
        known.has(url) && !known.get(url)
          ? null
          : crawl(url, { title: candidates[index]?.searchHit.result.title }),
      ),
    );
    for (const [index, judgment] of candidates.entries()) {
      const rationale = rationaleFor(judgment);
      const publishedAt = parsedPublishedAt(
        judgment.searchHit.result.publishedAt,
      );
      const page = pages[index] ?? null;
      const url = intakeUrls[index] ?? judgment.searchHit.result.url;
      const result = (await callTool("ingestScoutedSource", {
        url,
        title: judgment.searchHit.result.title,
        ...(publishedAt === undefined ? {} : { publishedAt }),
        ...(page ? { rawText: page.text, contentProvider: page.provider } : {}),
        query: judgment.searchHit.query.query,
        rationale,
        agentRunId: state.agentRunId,
      })) as { id?: unknown; created?: unknown; enriched?: unknown };
      if (typeof result.id !== "string") {
        throw new Error("ingestScoutedSource returned no source id");
      }
      const enriched = result.enriched === true;
      const write = {
        id: result.id,
        url,
        title: judgment.searchHit.result.title,
        targetGap: judgment.verdict.targetGap,
        rationale,
        created: result.created === true,
        ...(enriched ? { enriched } : {}),
      };
      sourceWrites.push(write);
      auditEvents.push(
        ...(await appendRemoteAuditEvent(
          callTool,
          state.agentRunId,
          write.created || enriched ? "tool_call" : "decision",
          write.created
            ? "Source scout ingested candidate source"
            : enriched
              ? "Source scout captured text for URL-only source"
              : "Source scout skipped duplicate source",
          {
            ...write,
            query: judgment.searchHit.query.query,
          },
        )),
      );
    }
    return { sourceWrites, auditEvents };
  };
}

export const ingestSourcesNode = createIngestSourcesNode();

export function routeAtStart(state: Pick<SourceScoutState, "mode">) {
  return state.mode === "recapture" ? "recapture_sources" : "fetch_targets";
}

type CaptureBacklogRow = {
  id: string;
  url: string;
  title?: string;
  query: string;
  rationale: string;
};

function asCaptureBacklog(value: unknown): CaptureBacklogRow[] {
  const rows = (value as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((entry): CaptureBacklogRow[] => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const { id, url, title, query, rationale } = row;
    return typeof id === "string" &&
      typeof url === "string" &&
      typeof query === "string" &&
      typeof rationale === "string"
      ? [
          {
            id,
            url,
            query,
            rationale,
            ...(typeof title === "string" && title ? { title } : {}),
          },
        ]
      : [];
  });
}

/**
 * Recapture mode: crawl every Scout URL-only Source again with the current
 * capture chain, and store any text through the same ingestScoutedSource
 * enrichment a discovery run uses, so this run is recorded as the capturer.
 */
export function createRecaptureSourcesNode(
  callTool: ToolCaller = callConvex,
  crawl: (
    url: string,
    hint?: PageHint,
  ) => Promise<CrawledPage | null> = createCrawlPage(),
) {
  return async (state: { agentRunId?: string }): Promise<SourceScoutUpdate> => {
    if (!state.agentRunId)
      throw new Error("source-scout requires agentRunId provenance");
    // Page through the backlog (least recently tried first) until a run's
    // worth of candidates, or its end.
    // Each call reads one bounded page of ingested URL Sources; a run reads
    // at most MAX_BACKLOG_PAGES and says so when it stopped short.
    const backlog: CaptureBacklogRow[] = [];
    let cursor: string | null = null;
    let backlogIncomplete = false;
    for (let page = 0; ; page++) {
      if (page >= MAX_BACKLOG_PAGES) {
        backlogIncomplete = true;
        break;
      }
      const result = (await callTool("listScoutCaptureBacklog", {
        cursor,
      })) as { continueCursor?: unknown; isDone?: unknown } | null;
      backlog.push(...asCaptureBacklog(result));
      if (
        backlog.length >= MAX_RECAPTURES_PER_RUN ||
        result?.isDone !== false ||
        typeof result.continueCursor !== "string" ||
        result.continueCursor === cursor
      )
        break;
      cursor = result.continueCursor;
    }
    backlog.splice(MAX_RECAPTURES_PER_RUN);
    const pages: Array<CrawledPage | null> = backlog.map(() => null);
    let next = 0;
    await Promise.all(
      Array.from(
        { length: Math.min(RECAPTURE_CONCURRENCY, backlog.length) },
        async () => {
          while (next < backlog.length) {
            const index = next++;
            const row = backlog[index];
            if (!row) continue;
            try {
              pages[index] = await crawl(
                row.url,
                row.title ? { title: row.title } : undefined,
              );
            } catch (error) {
              console.warn(
                "[source-scout] Recapture crawl failed:",
                redactError(error),
              );
            }
          }
        },
      ),
    );
    const sourceWrites: ScoutWriteResult[] = [];
    const auditEvents: AgentAuditEvent[] = [];
    for (const [index, row] of backlog.entries()) {
      const page = pages[index];
      if (!page) {
        // Intake records the failed attempt, moving the Source behind
        // untried ones for the next recapture run.
        try {
          await callTool("ingestScoutedSource", {
            url: row.url,
            ...(row.title ? { title: row.title } : {}),
            query: row.query,
            rationale: row.rationale,
            agentRunId: state.agentRunId,
          });
        } catch (error) {
          auditEvents.push(
            ...(await appendRemoteAuditEvent(
              callTool,
              state.agentRunId,
              "error",
              "Source scout recapture could not record a failed attempt",
              { id: row.id, url: row.url, error: redactError(error) },
            )),
          );
        }
        auditEvents.push(
          ...(await appendRemoteAuditEvent(
            callTool,
            state.agentRunId,
            "decision",
            "Source scout recapture found no usable text",
            { id: row.id, url: row.url },
          )),
        );
        continue;
      }
      let result: { id?: unknown; created?: unknown; enriched?: unknown };
      try {
        result = (await callTool("ingestScoutedSource", {
          url: row.url,
          ...(row.title ? { title: row.title } : {}),
          rawText: page.text,
          contentProvider: page.provider,
          query: row.query,
          rationale: row.rationale,
          agentRunId: state.agentRunId,
        })) as { id?: unknown; created?: unknown; enriched?: unknown };
      } catch (error) {
        // One refused write must not lose the rest of the run's captures.
        auditEvents.push(
          ...(await appendRemoteAuditEvent(
            callTool,
            state.agentRunId,
            "error",
            "Source scout recapture could not store captured text",
            { id: row.id, url: row.url, error: redactError(error) },
          )),
        );
        continue;
      }
      const enriched = result.enriched === true;
      const write = {
        id: typeof result.id === "string" ? result.id : row.id,
        url: row.url,
        title: row.title ?? row.url,
        targetGap: "recapture",
        rationale: row.rationale,
        created: result.created === true,
        ...(enriched ? { enriched } : {}),
      };
      sourceWrites.push(write);
      auditEvents.push(
        ...(await appendRemoteAuditEvent(
          callTool,
          state.agentRunId,
          enriched ? "tool_call" : "decision",
          enriched
            ? "Source scout captured text for URL-only source"
            : "Source scout recapture left the source unchanged",
          { ...write, provider: page.provider },
        )),
      );
    }
    return {
      sourceWrites,
      auditEvents,
      recaptureAttempted: backlog.length,
      recaptureBacklogIncomplete: backlogIncomplete,
    };
  };
}

export const recaptureSourcesNode = createRecaptureSourcesNode();

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
    const candidates = state.judgments
      .filter(
        (judgment): judgment is Extract<ScoutJudgment, { verdict: object }> =>
          judgment.verdict?.kind === "feed",
      )
      .filter((judgment) => {
        const url = judgment.searchHit.result.url;
        if (seenUrls.has(url)) return false;
        seenUrls.add(url);
        return true;
      })
      .slice(0, MAX_FEED_PROPOSALS_PER_RUN);
    for (const judgment of candidates) {
      const url = judgment.searchHit.result.url;
      const rationale = rationaleFor(judgment);
      const result = (await callTool("proposeFeed", {
        name: judgment.searchHit.result.title,
        url,
        type: feedType(url),
        rationale,
        sampleItems: [
          {
            title: judgment.searchHit.result.title,
            url: judgment.searchHit.result.url,
            snippet: judgment.searchHit.result.snippet,
            ...(judgment.searchHit.result.publishedAt
              ? { publishedAt: judgment.searchHit.result.publishedAt }
              : {}),
          },
        ],
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
    if (state.mode === "recapture") {
      const captured = state.sourceWrites.filter((write) => write.enriched);
      // finalizeRunCompleted identifies the graph by this prefix.
      const summary = `source-scout completed: recapture captured ${captured.length} of ${state.recaptureAttempted} URL-only sources${state.recaptureBacklogIncomplete ? " (backlog scan stopped at its page budget)" : ""}${captured.length ? `: ${captured.map((write) => write.title).join(" | ")}` : ""}`;
      const auditEvents = await finalizeRunCompleted(
        callTool,
        state.agentRunId,
        summary,
        state.traceUrl,
      );
      return { summary, auditEvents };
    }
    const gapCount =
      (state.targets?.thinDomains.length ?? 0) +
      (state.targets?.starvedConjectures.length ?? 0);
    const sourcesCreated = state.sourceWrites.filter(
      (write) => write.created,
    ).length;
    const sourcesEnriched = state.sourceWrites.filter(
      (write) => write.enriched,
    ).length;
    const feedsCreated = state.feedWrites.filter(
      (write) => write.created,
    ).length;
    const duplicates =
      state.sourceWrites.length +
      state.feedWrites.length -
      sourcesCreated -
      sourcesEnriched -
      feedsCreated;
    const rationales = [...state.sourceWrites, ...state.feedWrites]
      .map((write) => `${write.title}: ${write.rationale}`)
      .join(" | ");
    // Like the other graphs, a model outage completes with a summary that
    // names it, rather than an apparently empty success.
    const plannerFailed = (state.plannerErrorCount ?? 0) > 0;
    const judged = state.judgments?.length ?? 0;
    const allJudgesFailed = judged > 0 && state.judgeErrorCount === judged;
    const summary =
      gapCount === 0
        ? "source-scout completed: no research gaps"
        : plannerFailed
          ? `source-scout completed: query planning failed for ${gapCount} research gaps; no searches run (planner error)`
          : allJudgesFailed
            ? `source-scout completed: zero judgments; ${state.judgeErrorCount} judge errors discarded`
            : `source-scout completed: ${sourcesCreated} sources ingested, ${sourcesEnriched ? `${sourcesEnriched} URL-only sources captured, ` : ""}${feedsCreated} feeds proposed, ${duplicates} duplicates skipped, ${state.judgeErrorCount} judge errors${rationales ? `. Rationale: ${rationales}` : ""}`;
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
