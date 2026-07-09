import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getConvexUrl, getDevBypassSecret } from "./convexClient";

const SAVED = {
  CONVEX_SELF_HOSTED_URL: process.env.CONVEX_SELF_HOSTED_URL,
  CONVEX_URL: process.env.CONVEX_URL,
  AUTH_BYPASS_SECRET: process.env.AUTH_BYPASS_SECRET,
};

function restore() {
  for (const [key, value] of Object.entries(SAVED)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("getConvexUrl", () => {
  beforeEach(() => {
    delete process.env.CONVEX_SELF_HOSTED_URL;
    delete process.env.CONVEX_URL;
  });
  afterEach(restore);

  test("throws when neither env var is set", () => {
    expect(() => getConvexUrl()).toThrow(
      "Set CONVEX_SELF_HOSTED_URL or CONVEX_URL in .env.local",
    );
  });

  test("can preserve the current HTTP default for scripts that already had it", () => {
    expect(getConvexUrl({ useCurrentDeploymentDefault: true })).toBe(
      "http://convex-backend.paas.rproj.art",
    );
  });

  test("uses CONVEX_URL when it is the only one set", () => {
    process.env.CONVEX_URL = "http://only-url.example";
    expect(getConvexUrl()).toBe("http://only-url.example");
  });

  test("prefers CONVEX_SELF_HOSTED_URL when both are set", () => {
    process.env.CONVEX_SELF_HOSTED_URL = "http://self-hosted.example";
    process.env.CONVEX_URL = "http://other.example";
    expect(getConvexUrl()).toBe("http://self-hosted.example");
  });
});

describe("getDevBypassSecret", () => {
  afterEach(restore);

  test("returns the AUTH_BYPASS_SECRET env value", () => {
    const envValue = String(Date.now());
    process.env.AUTH_BYPASS_SECRET = envValue;
    expect(getDevBypassSecret()).toBe(envValue);
  });

  test("throws when the secret is missing", () => {
    delete process.env.AUTH_BYPASS_SECRET;
    expect(() => getDevBypassSecret()).toThrow("Set AUTH_BYPASS_SECRET");
  });
});
