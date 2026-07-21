import { Annotation } from "@langchain/langgraph";
import type { HypothesisDraftPayload } from "../../../convex/shared/draftPayloads.js";
import type { AgentAuditEvent } from "../graphs/shared/audit.js";

export type DrafterConcept = {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  domains: string[];
};

export type DrafterEvidenceClaim = {
  claimId: string;
  text: string;
  sourceId: string;
  extractionId: string;
  stance: "supports" | "contradicts";
  note?: string;
};

export type DraftableCorrespondence = {
  correspondenceId: string;
  pairKey: string;
  statement: string;
  rationaleMd: string;
  status: "evidenced" | "conjectured";
  similarityScore?: number;
  noveltyScore?: number;
  conceptA: DrafterConcept;
  conceptB: DrafterConcept;
  evidenceClaims: DrafterEvidenceClaim[];
};

export type HypothesisDraftContext = {
  evidenceClaims: DrafterEvidenceClaim[];
  sources: unknown[];
  priorHypotheses: unknown[];
  failureArchive: unknown[];
};

export type HypothesisSelfCheck = {
  pass: boolean;
  testable: boolean;
  oneVariable: boolean;
  evidenceGrounded: boolean;
  feedback: string;
};

export const HypothesisDrafterAnnotation = Annotation.Root({
  agentRunId: Annotation<string | undefined>,
  traceUrl: Annotation<string | undefined>,
  pendingCount: Annotation<number>({
    value: (_left, right) => right,
    default: () => 0,
  }),
  capReached: Annotation<boolean>({
    value: (_left, right) => right,
    default: () => false,
  }),
  target: Annotation<DraftableCorrespondence | undefined>,
  context: Annotation<HypothesisDraftContext | undefined>,
  draft: Annotation<HypothesisDraftPayload | undefined>,
  revisionCount: Annotation<number>({
    value: (_left, right) => right,
    default: () => 0,
  }),
  selfCheck: Annotation<HypothesisSelfCheck | undefined>,
  discarded: Annotation<boolean>({
    value: (_left, right) => right,
    default: () => false,
  }),
  discardReason: Annotation<string | undefined>,
  draftWritten: Annotation<boolean>({
    value: (_left, right) => right,
    default: () => false,
  }),
  draftId: Annotation<string | undefined>,
  auditEvents: Annotation<AgentAuditEvent[]>({
    value: (left, right) => left.concat(right),
    default: () => [],
  }),
  summary: Annotation<string | undefined>,
});

export type HypothesisDrafterState = typeof HypothesisDrafterAnnotation.State;
export type HypothesisDrafterUpdate = typeof HypothesisDrafterAnnotation.Update;
