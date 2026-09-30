// Cross-workspace contract for the agent-run lifecycle. Imported by both the
// Convex backend and the agent workspace; keep this module runtime-pure.
import { AGENT_RUN_STATUSES, type AgentRunStatus } from "./statuses";

export { AGENT_RUN_STATUSES, type AgentRunStatus };

export const PENDING_DRAFT_CAP = 3;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const LISTENING_DEBT_AFTER_MS = 14 * DAY_MS;
export const MAX_FEED_ENABLE_STATE_IDS = 20;
// Bounds on Source Scout page text: the agent trims captures to the maximum,
// and ingestScoutedSource rejects text too thin for Extraction.
export const SCOUTED_TEXT_MIN_CHARS = 100;
export const SCOUTED_TEXT_MAX_CHARS = 30_000;
// Self-hosted services that may supply Source Scout page text. Crawl4AI is
// tried first; the Lab's Firecrawl scrapes PDFs and pages Crawl4AI could not.
export const SCOUTED_CONTENT_PROVIDERS = ["crawl4ai", "firecrawl"] as const;
export type ScoutedContentProvider = (typeof SCOUTED_CONTENT_PROVIDERS)[number];

// Bot walls and browser checks that crawlers report as successful pages. Both
// Crawl4AI and Firecrawl returned JSTOR's "verifying your browser" page as
// content on 2026-09-30. Only short text is tested, so an article that merely
// discusses CAPTCHAs is not mistaken for one.
const BOT_CHALLENGE_MAX_CHARS = 3_000;
const BOT_CHALLENGE_MARKERS = [
  /\bverifying (?:that )?(?:you are|you're) (?:a )?human\b/i,
  /\bverify(?:ing)? your browser\b/i,
  /\bchecking (?:if the site connection is secure|your browser)\b/i,
  /a required part of this site couldn[’']t load/i,
  /^\W*just a moment\b/i,
  /\battention required\b.*cloudflare/is,
  /\benable javascript and cookies to continue\b/i,
  /\bplease (?:enable|turn on) (?:javascript|cookies)\b/i,
  /\b(?:are you a robot|verify you are (?:a )?human|prove you(?:'re| are) human)\b/i,
  /\b(?:captcha-delivery|datadome|perimeterx|px-captcha|incapsula incident)\b/i,
  /\b(?:complete the security check|press (?:&|and) hold)\b/i,
  /^\W*(?:access denied|captcha)\b/i,
];

/** True for short crawler text that is a bot wall or browser check. */
export function looksLikeBotChallenge(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > BOT_CHALLENGE_MAX_CHARS) return false;
  const unheaded = trimmed.replace(/^#+\s*/, "");
  return BOT_CHALLENGE_MARKERS.some((marker) => marker.test(unheaded));
}

export const AGENT_RUN_EVENT_KINDS = [
  "tool_call",
  "decision",
  "draft_write",
  "error",
  "review_request",
  "status",
  "node",
  // Emitted when cross-run agent memory (LangGraph Store) changes a decision.
  "memory_recall",
  // Per-model-call quota audit trail. Added after the original plan was written.
  "model_call",
] as const;
export type AgentRunEventKind = (typeof AGENT_RUN_EVENT_KINDS)[number];

// A heartbeat interval at or above the stale threshold would let the sweeper
// kill healthy in-flight runs.
export const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
export const STALE_RUN_MS = 30 * 60 * 1000;
if (HEARTBEAT_INTERVAL_MS >= STALE_RUN_MS) {
  throw new Error(
    "agentContract invariant violated: HEARTBEAT_INTERVAL_MS must be < STALE_RUN_MS",
  );
}

export const KNOWN_GRAPH_NAMES = [
  "research-pipeline",
  "weekly-brief",
  "correspondence-miner",
  "evidence-hunter",
  "hypothesis-drafter",
  "source-scout",
] as const;
export type KnownGraphName = (typeof KNOWN_GRAPH_NAMES)[number];

export function isKnownGraphName(name: string): name is KnownGraphName {
  return (KNOWN_GRAPH_NAMES as readonly string[]).includes(name);
}

export function normalizeTraceUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

// Which side owns the terminal Convex status write for each graph.
export const TERMINAL_STATUS_OWNER: Record<KnownGraphName, "graph" | "runner"> =
  {
    "research-pipeline": "graph",
    "weekly-brief": "runner",
    "correspondence-miner": "graph",
    "evidence-hunter": "graph",
    "hypothesis-drafter": "graph",
    "source-scout": "graph",
  };
