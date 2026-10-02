import { Annotation } from "@langchain/langgraph";
import type { AgentAuditEvent } from "../graphs/shared/audit.js";
import type { WebSearchResult } from "../tools/searchTool.js";

export type ScoutTargets = {
  thinDomains: Array<{
    domain: string;
    onMissionConceptCount: number;
    sourceCount: number;
  }>;
  starvedConjectures: Array<{
    correspondenceId: string;
    statement: string;
    conceptA: string;
    conceptB: string;
    evidenceCount: number;
  }>;
};

export type ScoutQuery = {
  query: string;
  targetGap: string;
  rationale: string;
};

export type ScoutSearchHit = {
  query: ScoutQuery;
  result: WebSearchResult;
};

export type ScoutVerdict = {
  kind: "source" | "feed" | "discard";
  relevanceNote: string;
  targetGap: string;
  evidenceLevelGuess?: string;
};

export type ScoutJudgment =
  | {
      searchHit: ScoutSearchHit;
      verdict: ScoutVerdict;
      discardReason?: never;
    }
  | {
      searchHit: ScoutSearchHit;
      verdict?: never;
      discardReason: { reason: "judge_error"; message: string };
    };

export type ScoutWriteResult = {
  id: string;
  url: string;
  title: string;
  targetGap: string;
  rationale: string;
  created: boolean;
  // A duplicate scout URL-only Source that gained captured text this run.
  enriched?: boolean;
};

function replaceArray<T>(_left: T[], right: T[]): T[] {
  return right;
}

export const SourceScoutAnnotation = Annotation.Root({
  agentRunId: Annotation<string | undefined>,
  // "recapture" retries page capture for Scout URL-only Sources instead of
  // discovering new ones.
  mode: Annotation<"recapture" | undefined>,
  recaptureAttempted: Annotation<number>({
    value: (_left, right) => right,
    default: () => 0,
  }),
  recaptureBacklogIncomplete: Annotation<boolean>({
    value: (_left, right) => right,
    default: () => false,
  }),
  traceUrl: Annotation<string | undefined>,
  targets: Annotation<ScoutTargets | undefined>,
  plannedQueries: Annotation<ScoutQuery[]>({
    value: replaceArray,
    default: () => [],
  }),
  searchHits: Annotation<ScoutSearchHit[]>({
    value: replaceArray,
    default: () => [],
  }),
  judgments: Annotation<ScoutJudgment[]>({
    value: replaceArray,
    default: () => [],
  }),
  plannerErrorCount: Annotation<number>({
    value: (_left, right) => right,
    default: () => 0,
  }),
  judgeErrorCount: Annotation<number>({
    value: (_left, right) => right,
    default: () => 0,
  }),
  sourceWrites: Annotation<ScoutWriteResult[]>({
    value: replaceArray,
    default: () => [],
  }),
  feedWrites: Annotation<ScoutWriteResult[]>({
    value: replaceArray,
    default: () => [],
  }),
  auditEvents: Annotation<AgentAuditEvent[]>({
    value: (left, right) => left.concat(right),
    default: () => [],
  }),
  summary: Annotation<string | undefined>,
});

export type SourceScoutState = typeof SourceScoutAnnotation.State;
export type SourceScoutUpdate = typeof SourceScoutAnnotation.Update;
