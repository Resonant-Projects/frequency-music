import { Annotation } from "@langchain/langgraph";

export type CandidateConcept = {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  domains: string[];
};

export type CandidateClaim = {
  id: string;
  text: string;
  sourceId: string;
  sourceTitle: string;
};

export type CorrespondenceCandidate = {
  conceptAId: string;
  conceptBId: string;
  pairKey: string;
  similarityScore: number;
  noveltyScore: number;
  domainsA: string[];
  domainsB: string[];
  sampleClaimIds: { a: string[]; b: string[] };
  conceptA: CandidateConcept;
  conceptB: CandidateConcept;
  sampleClaims: { a: CandidateClaim[]; b: CandidateClaim[] };
};

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
  summary: Annotation<string | undefined>,
});

export type CorrespondenceMinerState =
  typeof CorrespondenceMinerAnnotation.State;
export type CorrespondenceMinerUpdate =
  typeof CorrespondenceMinerAnnotation.Update;
