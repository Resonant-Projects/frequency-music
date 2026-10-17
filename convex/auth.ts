import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import {
  type AuthFailureEvent,
  type AuthFailureReason,
  authFailureLogLine,
  classifyBypassRejection,
} from "./shared/authFailures";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;

export interface AppIdentity {
  subject: string;
  tokenIdentifier: string;
  email?: string;
  name?: string;
  isBypass: boolean;
}

interface RequireAuthOptions {
  devBypassSecret?: string;
}

function isBypassEnabled() {
  return process.env.AUTH_BYPASS_ENABLED === "true";
}

function getConfiguredBypassSecret() {
  return process.env.AUTH_BYPASS_SECRET;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  // Compare UTF-16 code units directly: TextEncoder maps lone surrogates to
  // U+FFFD, which would let distinct malformed strings compare equal.
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Logs and persists one rejection from an action or HTTP action. Recording is
 * best effort: a failed write never changes the caller's rejection.
 */
export async function recordAuthFailure(
  ctx: Pick<ActionCtx, "runMutation">,
  event: AuthFailureEvent,
): Promise<void> {
  try {
    await ctx.runMutation(internal.authFailures.record, event);
    console.warn(authFailureLogLine(event, true));
  } catch {
    console.warn(authFailureLogLine(event, false));
  }
}

/** A query or mutation rolls back on rejection, so only a log line survives. */
function logTransactionalAuthFailure(event: AuthFailureEvent) {
  console.warn(authFailureLogLine(event, false));
}

/** Why an AGENT_TOOL_SECRET was refused, or null when it is accepted. */
export function agentToolSecretRejection(
  provided: unknown,
): AuthFailureReason | null {
  const expected = process.env.AGENT_TOOL_SECRET;
  if (!expected) return "server_unconfigured";
  if (typeof provided !== "string" || provided === "") return "missing_secret";
  return constantTimeEqual(provided, expected) ? null : "secret_mismatch";
}

function invalidAgentToolSecret(): never {
  throw new ConvexError({
    code: "UNAUTHORIZED",
    message: "Invalid agent tool secret",
  });
}

/** Query and mutation boundary; `operation` labels the rejection log line. */
export function requireAgentToolSecret(
  provided: string,
  operation = "mutation:unknown",
): void {
  const reason = agentToolSecretRejection(provided);
  if (!reason) return;
  logTransactionalAuthFailure({ surface: "agent_tool", reason, operation });
  invalidAgentToolSecret();
}

/** Action boundary: the rejection is persisted before the call fails. */
export async function requireAgentToolSecretInAction(
  ctx: Pick<ActionCtx, "runMutation">,
  provided: string,
  event: Omit<AuthFailureEvent, "reason">,
): Promise<void> {
  const reason = agentToolSecretRejection(provided);
  if (!reason) return;
  await recordAuthFailure(ctx, { ...event, reason });
  invalidAgentToolSecret();
}

export async function requireAuth(
  ctx: AuthCtx,
  options?: RequireAuthOptions,
): Promise<AppIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    return {
      subject: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email ?? undefined,
      name: identity.name ?? undefined,
      isBypass: false,
    };
  }

  if (isBypassEnabled()) {
    const configuredSecret = getConfiguredBypassSecret();
    if (!configuredSecret) {
      console.error(
        "requireAuth: AUTH_BYPASS_ENABLED=true but AUTH_BYPASS_SECRET is not set on the server.",
      );
      if (options?.devBypassSecret !== undefined)
        await reportBypassRejection(ctx, "server_unconfigured");
      throw new ConvexError({
        code: "CONFIGURATION_ERROR",
        message: "Bypass is enabled but AUTH_BYPASS_SECRET is not configured",
      });
    }
    const providedSecret = options?.devBypassSecret;

    if (
      configuredSecret &&
      providedSecret &&
      constantTimeEqual(providedSecret, configuredSecret)
    ) {
      return {
        // Schema requires createdBy to be either a users table id or "system".
        // In bypass mode we intentionally persist writes as system-authored.
        subject: "system",
        tokenIdentifier: "dev-bypass-token",
        email: "local-dev@resonantrhythm.local",
        name: "Local Dev Bypass",
        isBypass: true,
      };
    }
  }

  const reason = classifyBypassRejection({
    provided: options?.devBypassSecret,
    enabled: isBypassEnabled(),
  });
  if (reason) await reportBypassRejection(ctx, reason);

  throw new ConvexError({
    code: "UNAUTHORIZED",
    message: "Authentication required",
  });
}

function isActionCtx(ctx: AuthCtx): ctx is ActionCtx {
  return !("db" in ctx) && "runMutation" in ctx;
}

async function reportBypassRejection(ctx: AuthCtx, reason: AuthFailureReason) {
  if (isActionCtx(ctx))
    await recordAuthFailure(ctx, {
      surface: "bypass",
      reason,
      operation: "requireAuth:action",
    });
  else
    logTransactionalAuthFailure({
      surface: "bypass",
      reason,
      operation: "requireAuth:transaction",
    });
}
