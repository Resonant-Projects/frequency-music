import { ConvexError } from "convex/values";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

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
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= (bufA[i] as number) ^ (bufB[i] as number);
  }
  return result === 0;
}

export function requireAgentToolSecret(provided: string): void {
  const expected = process.env.AGENT_TOOL_SECRET;
  if (!expected || !constantTimeEqual(provided, expected)) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Invalid agent tool secret",
    });
  }
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

  throw new ConvexError({
    code: "UNAUTHORIZED",
    message: "Authentication required",
  });
}
