import { Annotation } from "@langchain/langgraph";
import type { AgentAuditEvent } from "../graphs/shared/audit.js";

export type TranscriptCaptureTally = {
  attempted: number;
  captured: string[];
  unavailable: number;
  failed: number;
  rateLimited: boolean;
  notConfigured: boolean;
};

export const TranscriptCaptureAnnotation = Annotation.Root({
  agentRunId: Annotation<string | undefined>,
  traceUrl: Annotation<string | undefined>,
  tally: Annotation<TranscriptCaptureTally | undefined>,
  auditEvents: Annotation<AgentAuditEvent[]>({
    value: (left, right) => left.concat(right),
    default: () => [],
  }),
  summary: Annotation<string | undefined>,
});

export type TranscriptCaptureState = typeof TranscriptCaptureAnnotation.State;
export type TranscriptCaptureUpdate = typeof TranscriptCaptureAnnotation.Update;
