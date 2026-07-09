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
  kind:
    | "tool_call"
    | "decision"
    | "draft_write"
    | "error"
    | "review_request"
    | "status"
    | "node"
    | "model_call";
  message: string;
  payload?: unknown;
  createdAt: string;
}

/**
 * Structured, promotable draft payloads. These MUST match the deployed Convex
 * `agentReviewDrafts.payload` union (see convex/schema.ts) so that human
 * approval can promote a draft into a real hypothesis/recipe loss-free. A draft
 * WITHOUT a payload is still valid — it is an acknowledged review record only,
 * never promotable.
 */
export interface HypothesisDraftPayload {
  title: string;
  question: string;
  statement: string;
  rationale: string;
  whyThisMatters: string;
  concepts?: string[];
  /** Id<sources> values that must have been READ during this run. */
  sourceIds: string[];
  /** Id<extractions> values that must have been READ during this run. */
  extractionIds: string[];
  /** Id<theses> that must have been READ during this run. */
  thesisId?: string;
  confidence?: number;
}

export interface RecipeDraftParameter {
  kind?: string;
  type?: string;
  value: string;
  details?: string;
}

export interface RecipeDraftProtocol {
  studyType: "litmus" | "comparison";
  durationSecs: number;
  panelPlanned: string[];
  listeningContext?: string;
  listeningMethod?: string;
  whatVaries: string[];
  whatStaysConstant: string[];
}

export interface RecipeDraftPayload {
  /** Id<hypotheses> that must have been READ during this run. */
  hypothesisId?: string;
  title: string;
  parameters: RecipeDraftParameter[];
  protocol?: RecipeDraftProtocol;
  whyThisMatters: string;
  bodyMd?: string;
  dawChecklist?: string[];
  instrumentationNotes?: string;
}

export type ResearchPipelineDraftPayload =
  | HypothesisDraftPayload
  | RecipeDraftPayload;

export interface ResearchPipelineDraft {
  kind: "dry_run_summary" | "hypothesis_draft" | "recipe_draft";
  title: string;
  summary: string;
  candidateIds: string[];
  needsReview: boolean;
  /**
   * Optional structured payload. When present it is validated against the
   * hallucinated-ID gate before persistence and is the shape promotion reads.
   */
  payload?: ResearchPipelineDraftPayload;
}

function replaceArray<T>(_left: T[], right: T[]) {
  return right;
}

/** Union/concat-dedupe reducer for the seenIds accumulator channel. */
function unionStrings(left: string[], right: string[]): string[] {
  return Array.from(new Set([...left, ...right]));
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
  // Accumulates EVERY Convex id the run actually READ (extraction, source,
  // hypothesis, thesis, recipe ids). The hallucinated-ID gate checks payload
  // ids against this set, so any id here must come from a real tool result.
  seenIds: Annotation<string[]>({
    value: unionStrings,
    default: () => [],
  }),
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
