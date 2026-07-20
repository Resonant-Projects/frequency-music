import { Annotation } from "@langchain/langgraph";
import type {
  EvidenceTargetPayload,
  SemanticClaimPayload,
} from "../../../convex/shared/correspondenceCandidates.js";
import type { AgentAuditEvent } from "../graphs/shared/audit.js";

export type EvidenceTarget = EvidenceTargetPayload;
export type SemanticClaim = SemanticClaimPayload;

export type TargetClaimSearch = {
  target: EvidenceTarget;
  claims: SemanticClaim[];
};

export type StanceVerdict = {
  stance: "supports" | "contradicts" | "irrelevant";
  note: string;
};

export type EvidenceJudgment = {
  target: EvidenceTarget;
  claim: SemanticClaim;
  verdict: StanceVerdict;
};

function replaceArray<T>(_left: T[], right: T[]): T[] {
  return right;
}

export const EvidenceHunterAnnotation = Annotation.Root({
  agentRunId: Annotation<string | undefined>,
  traceUrl: Annotation<string | undefined>,
  limit: Annotation<number | undefined>,
  targets: Annotation<EvidenceTarget[]>({
    value: replaceArray,
    default: () => [],
  }),
  searches: Annotation<TargetClaimSearch[]>({
    value: replaceArray,
    default: () => [],
  }),
  judgments: Annotation<EvidenceJudgment[]>({
    value: replaceArray,
    default: () => [],
  }),
  evidenceAddedCount: Annotation<number>({
    value: (_left, right) => right,
    default: () => 0,
  }),
  irrelevantCount: Annotation<number>({
    value: (_left, right) => right,
    default: () => 0,
  }),
  evidenceAddedByTarget: Annotation<Record<string, number>>({
    value: (_left, right) => right,
    default: () => ({}),
  }),
  auditEvents: Annotation<AgentAuditEvent[]>({
    value: (left, right) => left.concat(right),
    default: () => [],
  }),
  summary: Annotation<string | undefined>,
});

export type EvidenceHunterState = typeof EvidenceHunterAnnotation.State;
export type EvidenceHunterUpdate = typeof EvidenceHunterAnnotation.Update;
