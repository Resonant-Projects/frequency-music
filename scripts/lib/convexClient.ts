// oxlint-disable-next-line import/no-unassigned-import -- Loads env-backed values before client resolution.
import "varlock/auto-load";
import { ConvexHttpClient } from "convex/browser";

export function getConvexUrl(): string {
  return (
    process.env.CONVEX_SELF_HOSTED_URL ??
    process.env.CONVEX_URL ??
    "http://convex-backend.paas.rproj.art"
  );
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
