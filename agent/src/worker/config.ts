export const DEFAULT_WORKER_POLL_INTERVAL_MS = 15000;

export function resolveWorkerPollIntervalMs(value: string | undefined): number {
  if (value === undefined) return DEFAULT_WORKER_POLL_INTERVAL_MS;
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_WORKER_POLL_INTERVAL_MS;
}

export function normalizeConvexSiteUrlEnv(): void {
  const convexSiteUrl =
    process.env.CONVEX_SITE_URL?.trim() ||
    process.env.CONVEX_URL?.trim() ||
    process.env.CONVEX_SELF_HOSTED_URL?.trim();
  if (convexSiteUrl) process.env.CONVEX_SITE_URL = convexSiteUrl;
}
