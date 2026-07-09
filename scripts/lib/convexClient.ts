// oxlint-disable-next-line import/no-unassigned-import -- Loads env-backed values before client resolution.
import "varlock/auto-load";
import { ConvexHttpClient } from "convex/browser";

export function getConvexUrl(): string {
  const url = process.env.CONVEX_SELF_HOSTED_URL ?? process.env.CONVEX_URL;
  if (!url) {
    throw new Error("Set CONVEX_SELF_HOSTED_URL or CONVEX_URL in .env.local");
  }
  return url;
}

export function getConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(getConvexUrl());
}

export function getDevBypassSecret(): string {
  const secret = process.env.AUTH_BYPASS_SECRET;
  if (!secret) {
    throw new Error("Set AUTH_BYPASS_SECRET in .env.local or 1Password");
  }
  return secret;
}
