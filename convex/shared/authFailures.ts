// Contract for rejected service-identity calls (improvements ledger #20).
// A row or log line names the surface, a fixed reason, and a bounded label;
// it never carries a presented secret, a hash of one, or request headers.
import type { AgentToolName } from "./agentToolArgs";
import { AGENT_TOOL_MANIFEST } from "./agentToolManifest";
import { truncateText } from "./truncateText";

export const AUTH_FAILURE_SURFACES = [
  "bypass",
  "agent_tool",
  "media_tool",
] as const;
export type AuthFailureSurface = (typeof AUTH_FAILURE_SURFACES)[number];

export const AUTH_FAILURE_REASONS = [
  "missing_secret",
  "secret_mismatch",
  "bypass_disabled",
  "server_unconfigured",
] as const;
export type AuthFailureReason = (typeof AUTH_FAILURE_REASONS)[number];

/** Counters are bucketed per surface, reason, and operation per hour. */
export const AUTH_FAILURE_WINDOW_MS = 60 * 60 * 1000;
/** Rejections in one surface-hour that raise one alert line. */
export const AUTH_FAILURE_ALERT_THRESHOLD = 3;
export const AUTH_FAILURE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
/** Expired rows deleted per new bucket, so pruning stays bounded. */
export const AUTH_FAILURE_PRUNE_BATCH = 25;
export const AUTH_FAILURE_LABEL_MAX = 80;
export const AUTH_FAILURE_USER_AGENT_MAX = 120;

export const AUTH_FAILURE_LOG_MARKER = "[auth-failure]";
export const AUTH_FAILURE_ALERT_MARKER = "[auth-failure-alert]";

export type AuthFailureEvent = {
  surface: AuthFailureSurface;
  reason: AuthFailureReason;
  /** Tool or entry-point label, e.g. `http:claimNextMediaJob`. */
  operation: string;
  /** Truncated User-Agent from an HTTP call; the only header ever kept. */
  userAgent?: string;
};

/** Printable ASCII only, single-spaced, truncated. Empty becomes "unknown". */
export function boundedLabel(value: string | null | undefined, max: number) {
  const printable = (value ?? "")
    .replaceAll(/[^\x20-\x7e]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
  return truncateText(printable, max) || "unknown";
}

const MEDIA_TOOLS: ReadonlySet<string> = new Set(
  AGENT_TOOL_MANIFEST.filter((tool) => tool.kind === "media_write").map(
    (tool) => tool.name,
  ),
);

/** The media service is the only caller of media_write tools. */
export function agentToolSurface(name: AgentToolName): AuthFailureSurface {
  return MEDIA_TOOLS.has(name) ? "media_tool" : "agent_tool";
}

export function windowStartFor(now: number): number {
  return now - (now % AUTH_FAILURE_WINDOW_MS);
}

/** Classifies a presented bypass secret; null means no bypass was attempted. */
export function classifyBypassRejection(input: {
  provided: string | undefined;
  enabled: boolean;
}): AuthFailureReason | null {
  if (input.provided === undefined) return null;
  if (!input.enabled) return "bypass_disabled";
  return input.provided === "" ? "missing_secret" : "secret_mismatch";
}

/** One grep-able line; `persisted` says whether a counter row was written. */
export function authFailureLogLine(
  event: AuthFailureEvent,
  persisted: boolean,
): string {
  return [
    AUTH_FAILURE_LOG_MARKER,
    `surface=${event.surface}`,
    `reason=${event.reason}`,
    `operation=${boundedLabel(event.operation, AUTH_FAILURE_LABEL_MAX)}`,
    `persisted=${persisted}`,
  ].join(" ");
}

export function authFailureAlertLine(input: {
  surface: AuthFailureSurface;
  windowStart: number;
  total: number;
}): string {
  return [
    AUTH_FAILURE_ALERT_MARKER,
    `surface=${input.surface}`,
    `window=${new Date(input.windowStart).toISOString()}`,
    `rejections=${input.total}`,
    `threshold=${AUTH_FAILURE_ALERT_THRESHOLD}`,
    "action=see docs/service-identity-inventory.md",
  ].join(" ");
}
