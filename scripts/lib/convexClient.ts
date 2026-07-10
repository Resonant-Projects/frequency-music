// oxlint-disable-next-line import/no-unassigned-import -- Loads env-backed values before client resolution.
import "varlock/auto-load";
import { ConvexHttpClient } from "convex/browser";

interface ConvexClientOptions {
  useCurrentDeploymentDefault?: boolean;
}

export function getConvexUrl(options: ConvexClientOptions = {}): string {
  const url = process.env.CONVEX_SELF_HOSTED_URL ?? process.env.CONVEX_URL;
  if (url) return url;
  if (options.useCurrentDeploymentDefault) {
    return "https://convex.resonantprojects.art";
  }
  throw new Error("Set CONVEX_SELF_HOSTED_URL or CONVEX_URL in .env.local");
}

export function getConvexClient(
  options: ConvexClientOptions = {},
): ConvexHttpClient {
  return new ConvexHttpClient(getConvexUrl(options));
}

export function getDevBypassSecret(): string {
  const secret = process.env.AUTH_BYPASS_SECRET;
  if (!secret) {
    throw new Error("Set AUTH_BYPASS_SECRET in .env.local or 1Password");
  }
  return secret;
}
