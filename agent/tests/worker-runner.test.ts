import { describe, expect, test } from "vite-plus/test";

import {
  DEFAULT_WORKER_POLL_INTERVAL_MS,
  normalizeConvexSiteUrlEnv,
  resolveWorkerPollIntervalMs,
} from "../src/worker/config";

describe("worker runner config", () => {
  test("validates the poll interval and falls back on invalid values", () => {
    expect(resolveWorkerPollIntervalMs(undefined)).toBe(
      DEFAULT_WORKER_POLL_INTERVAL_MS,
    );
    expect(resolveWorkerPollIntervalMs("2500")).toBe(2500);
    expect(resolveWorkerPollIntervalMs("2500.9")).toBe(2500);
    expect(resolveWorkerPollIntervalMs("0")).toBe(
      DEFAULT_WORKER_POLL_INTERVAL_MS,
    );
    expect(resolveWorkerPollIntervalMs("-1")).toBe(
      DEFAULT_WORKER_POLL_INTERVAL_MS,
    );
    expect(resolveWorkerPollIntervalMs("not-a-number")).toBe(
      DEFAULT_WORKER_POLL_INTERVAL_MS,
    );
  });

  test("normalizes Convex URL aliases into CONVEX_SITE_URL", () => {
    const originalSiteUrl = process.env.CONVEX_SITE_URL;
    const originalUrl = process.env.CONVEX_URL;
    const originalSelfHostedUrl = process.env.CONVEX_SELF_HOSTED_URL;

    try {
      Reflect.deleteProperty(process.env, "CONVEX_SITE_URL");
      process.env.CONVEX_URL = "https://convex.example";
      process.env.CONVEX_SELF_HOSTED_URL = "https://self-hosted.example";
      normalizeConvexSiteUrlEnv();
      expect(process.env.CONVEX_SITE_URL).toBe("https://convex.example");

      process.env.CONVEX_SITE_URL = "https://site.example";
      normalizeConvexSiteUrlEnv();
      expect(process.env.CONVEX_SITE_URL).toBe("https://site.example");
    } finally {
      if (originalSiteUrl === undefined) delete process.env.CONVEX_SITE_URL;
      else process.env.CONVEX_SITE_URL = originalSiteUrl;

      if (originalUrl === undefined)
        Reflect.deleteProperty(process.env, "CONVEX_URL");
      else process.env.CONVEX_URL = originalUrl;

      if (originalSelfHostedUrl === undefined)
        Reflect.deleteProperty(process.env, "CONVEX_SELF_HOSTED_URL");
      else process.env.CONVEX_SELF_HOSTED_URL = originalSelfHostedUrl;
    }
  });
});
