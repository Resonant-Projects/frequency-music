import type { Doc } from "../../../convex/_generated/dataModel";

export type AgentRunStatus = Doc<"agentRuns">["status"];
export type AgentRunEventKind = Doc<"agentRunEvents">["kind"];
export type AgentRunBadgeTone = "gold" | "violet" | "cream";

/** The timestamps every agent-run surface reports. */
export type AgentRunTimes = Pick<
  Doc<"agentRuns">,
  "createdAt" | "startedAt" | "finishedAt" | "updatedAt"
>;

/** Badge tone for a run's lifecycle status: failed is violet, done is gold. */
export function runStatusTone(status: AgentRunStatus): AgentRunBadgeTone {
  if (status === "failed") return "violet";
  if (status === "completed") return "gold";
  return "cream";
}

/** Badge tone for a timeline event: errors violet, decisions gold. */
export function eventTone(kind: AgentRunEventKind): AgentRunBadgeTone {
  if (kind === "error") return "violet";
  if (kind === "decision" || kind === "review_request") return "gold";
  return "cream";
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

/** Medium date and time in the reader's locale, or an em dash when unset. */
export function formatTime(value?: number) {
  if (!value) return "—";
  return timeFormatter.format(new Date(value));
}

/** Machine-readable `datetime` value for a `<time>` element. */
export function isoTime(value?: number) {
  return value ? new Date(value).toISOString() : undefined;
}

/** Wall-clock duration from start (or creation) to finish (or last update). */
export function formatDuration(run: AgentRunTimes) {
  const start = run.startedAt ?? run.createdAt;
  const end = run.finishedAt ?? run.updatedAt;
  const durationMs = Math.max(0, end - start);
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

/** Pretty-printed JSON for an event payload, or "" when there is none. */
export function formatPayload(payload: unknown) {
  if (payload === undefined || payload === null) return "";
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    // oxlint-disable-next-line typescript/no-base-to-string -- Preserve the existing fallback for non-JSON-serializable payloads.
    return String(payload);
  }
}
