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

  throw new Error("Unauthorized");
}
