import { ConvexError } from "convex/values";

const MESSAGE_BY_CODE: Record<string, string> = {
  UNAUTHORIZED: "You need to be signed in to see this.",
  FORBIDDEN: "You do not have access to this.",
  NOT_FOUND: "That item could not be found.",
};

const SERVER_FAILURE = "The server could not complete this request.";
const NETWORK_FAILURE = "Could not reach the server. Check your connection.";

function dataFrom(err: unknown): unknown {
  if (err instanceof ConvexError) return err.data;
  // Errors that crossed the websocket arrive flattened into the message:
  // "[CONVEX Q(x:y)] [Request ID: …] Server Error Uncaught ConvexError:
  // {"code":"…","message":"…"} at handler (../convex/x.ts:1:2) …"
  const message = messageFrom(err);
  const match = message.match(/ConvexError: (\{.*?\})(?:\s|$)/);
  if (!match?.[1]) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

function messageFrom(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

/**
 * Plain-language description of a failed Convex call for the notice regions.
 * Request ids, stack frames and file paths stay out of the UI; keep the raw
 * error as `cause` (see `toError`) or log it for debugging.
 */
export function describeError(err: unknown): string {
  const data = dataFrom(err);
  if (data && typeof data === "object") {
    const { code, message } = data as { code?: unknown; message?: unknown };
    if (typeof code === "string" && MESSAGE_BY_CODE[code]) {
      return MESSAGE_BY_CODE[code];
    }
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof data === "string" && data.trim()) return data;

  const message = messageFrom(err);
  if (/\[CONVEX |Request ID|Server Error|Uncaught/.test(message)) {
    return SERVER_FAILURE;
  }
  if (/Failed to fetch|NetworkError|network|WebSocket/i.test(message)) {
    return NETWORK_FAILURE;
  }
  return message.trim() || SERVER_FAILURE;
}

/** Wrap any thrown value as an Error whose message is safe to show users. */
export function toError(err: unknown): Error {
  return new Error(describeError(err), { cause: err });
}
