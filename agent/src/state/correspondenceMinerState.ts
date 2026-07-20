import { Annotation } from "@langchain/langgraph";
import type {
  CandidateClaimPayload,
  CandidateConceptPayload,
  CorrespondenceCandidatePayload,
} from "../../../convex/shared/correspondenceCandidates.js";
import type { AgentAuditEvent } from "../graphs/shared/audit.js";

export type CandidateConcept = CandidateConceptPayload;
export type CandidateClaim = CandidateClaimPayload;
export type CorrespondenceCandidate = CorrespondenceCandidatePayload;

export type MinerVerdict = {
  accept: boolean;
  statement: string;
  rationaleMd: string;
  relationship?: string;
  confidenceNote: string;
};

export type MinerDecision = {
  candidate: CorrespondenceCandidate;
  verdict: MinerVerdict;
  supportingClaimIds: string[];
  discardReason?: { reason: "judge_error"; message: string };
};

function replaceArray<T>(_left: T[], right: T[]): T[] {
  return right;
}

export const CorrespondenceMinerAnnotation = Annotation.Root({
  agentRunId: Annotation<string | undefined>,
  traceUrl: Annotation<string | undefined>,
  limit: Annotation<number | undefined>,
  candidates: Annotation<CorrespondenceCandidate[]>({
    value: replaceArray,
    default: () => [],
  }),
  decisions: Annotation<MinerDecision[]>({
    value: replaceArray,
    default: () => [],
  }),
  judgeErrorCount: Annotation<number>({
    value: (_left, right) => right,
    default: () => 0,
  }),
  acceptedCount: Annotation<number>({
    value: (_left, right) => right,
    default: () => 0,
  }),
  discardedCount: Annotation<number>({
    value: (_left, right) => right,
    default: () => 0,
  }),
  evidenceAddedCount: Annotation<number>({
    value: (_left, right) => right,
    default: () => 0,
  }),
  auditEvents: Annotation<AgentAuditEvent[]>({
    value: (left, right) => left.concat(right),
    default: () => [],
  }),
  summary: Annotation<string | undefined>,
});

export type CorrespondenceMinerState =
  typeof CorrespondenceMinerAnnotation.State;
export type CorrespondenceMinerUpdate =
  typeof CorrespondenceMinerAnnotation.Update;
