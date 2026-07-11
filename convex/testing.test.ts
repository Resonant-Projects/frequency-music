import { describe, expect, test } from "vite-plus/test";
import { ConvexError } from "convex/values";
import { assertBypassIdentity } from "./testing";

describe("testing helpers", () => {
  test("allows bypass identities to seed campaigns", () => {
    expect(() =>
      assertBypassIdentity({
        isBypass: true,
      }),
    ).not.toThrow();
  });

  test("rejects non-bypass identities from seeding campaigns", () => {
    expect(() =>
      assertBypassIdentity({
        isBypass: false,
      }),
    ).toThrow(
      new ConvexError({
        code: "UNAUTHORIZED",
        message: "Bypass authentication is required for seedCampaigns",
      }),
    );
  });
});
