import { describe, expect, test } from "vite-plus/test";
import { loadConfig } from "../src/config";

const base = { CONVEX_SITE_URL: "https://convex.test", AGENT_TOOL_SECRET: "s" };

describe("loadConfig", () => {
  test("defaults and https site url", () => {
    const config = loadConfig(base);
    expect(config.convexSiteUrl).toBe("https://convex.test");
    expect(config.workerId).toBe("media-local");
    expect(config.pollIntervalMs).toBe(15000);
    expect(config.kinds).toEqual(["probe"]);
  });

  test("refuses a plain-http site url unless explicitly allowed", () => {
    expect(() =>
      loadConfig({ ...base, CONVEX_SITE_URL: "http://convex.lan:3211" }),
    ).toThrow(/https/);
    expect(
      loadConfig({
        ...base,
        CONVEX_SITE_URL: "http://convex.lan:3211",
        MEDIA_ALLOW_INSECURE_CONVEX: "true",
      }).convexSiteUrl,
    ).toBe("http://convex.lan:3211");
  });

  test("scheme check is case-insensitive and rejects non-http schemes", () => {
    expect(() =>
      loadConfig({ ...base, CONVEX_SITE_URL: "HTTP://convex.lan:3211" }),
    ).toThrow(/https/);
    expect(() =>
      loadConfig({
        ...base,
        CONVEX_SITE_URL: "ftp://x",
        MEDIA_ALLOW_INSECURE_CONVEX: "true",
      }),
    ).toThrow(/https/);
    expect(() => loadConfig({ ...base, CONVEX_SITE_URL: "not a url" })).toThrow(
      /valid URL/,
    );
  });
});
