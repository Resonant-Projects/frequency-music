import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";

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
      providedSecret === configuredSecret
    ) {
      return {
        subject: "dev-bypass-user",
        tokenIdentifier: "dev-bypass-token",
        email: "local-dev@resonantrhythm.local",
        name: "Local Dev Bypass",
        isBypass: true,
      };
    }
  }

  throw new ConvexError({ code: "UNAUTHORIZED", message: "Authentication required" });
}
