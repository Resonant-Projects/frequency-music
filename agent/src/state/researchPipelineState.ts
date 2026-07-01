import { Annotation } from "@langchain/langgraph";

export type CandidateRoute =
  | "extract"
  | "hypothesize"
  | "recipe"
  | "critique"
  | "archive"
  | "stop";

export interface ResearchCandidate {
  id: string;
  kind: "source" | "extraction" | "hypothesis" | "recipe" | "recommended_action";
  route: CandidateRoute;
  title?: string;
  reason: string;
  score: number;
}

export interface AuditEvent {
  kind: "tool_call" | "decision" | "draft_write" | "error" | "review_request" | "status" | "node";
  message: string;
  payload?: unknown;
  createdAt: string;
}

export interface ResearchPipelineDraft {
  kind: "dry_run_summary" | "hypothesis_draft" | "recipe_draft";
  title: string;
  summary: string;
  candidateIds: string[];
  needsReview: boolean;
}

function replaceArray<T>(_left: T[], right: T[]) {
  return right;
}

export const ResearchPipelineAnnotation = Annotation.Root({
  runId: Annotation<string | undefined>,
  // agentRunId may be SEEDED as graph input by the production worker to reuse a
  // pre-claimed Convex agentRun (see initializeRunNode double-create guard). When
  // absent, initializeRunNode creates a fresh audit record itself.
  agentRunId: Annotation<string | undefined>,
  dryRun: Annotation<boolean | undefined>,
  smokeMode: Annotation<boolean | undefined>,
  limit: Annotation<number | undefined>,
  activeTheses: Annotation<unknown[]>({ value: replaceArray, default: () => [] }),
  recentExtractions: Annotation<unknown[]>({ value: replaceArray, default: () => [] }),
  recentHypotheses: Annotation<unknown[]>({ value: replaceArray, default: () => [] }),
  recentRecipes: Annotation<unknown[]>({ value: replaceArray, default: () => [] }),
  failureArchive: Annotation<unknown[]>({ value: replaceArray, default: () => [] }),
  editorialSignals: Annotation<unknown[]>({ value: replaceArray, default: () => [] }),
  recommendedActions: Annotation<unknown[]>({ value: replaceArray, default: () => [] }),
  candidates: Annotation<ResearchCandidate[]>({ value: replaceArray, default: () => [] }),
  selectedCandidate: Annotation<ResearchCandidate | undefined>,
  route: Annotation<CandidateRoute | undefined>,
  draft: Annotation<ResearchPipelineDraft | undefined>,
  errors: Annotation<string[]>({
    value: (left, right) => left.concat(right),
    default: () => [],
  }),
  auditEvents: Annotation<AuditEvent[]>({
    value: (left, right) => left.concat(right),
    default: () => [],
  }),
});

export type ResearchPipelineState = typeof ResearchPipelineAnnotation.State;
export type ResearchPipelineUpdate = typeof ResearchPipelineAnnotation.Update;
