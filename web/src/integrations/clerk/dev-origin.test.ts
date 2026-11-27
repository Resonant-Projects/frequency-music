// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import {
  CLERK_LOCAL_DEV_ORIGIN,
  localDevSignInBlocked,
  localDevSignInUrl,
  productionClerkAcceptsOrigin,
} from "./dev-origin";

const liveKey = "pk_live_example";
const testKey = "pk_test_example";

describe("productionClerkAcceptsOrigin", () => {
  it("accepts the production app and the local HTTPS host", () => {
    expect(
      productionClerkAcceptsOrigin(
        {
          protocol: "https:",
          hostname: "app.resonantprojects.art",
          port: "",
        },
        liveKey,
      ),
    ).toBe(true);
    expect(
      productionClerkAcceptsOrigin(
        {
          protocol: "https:",
          hostname: "local.resonantprojects.art",
          port: "",
        },
        liveKey,
      ),
    ).toBe(true);
  });

  it("rejects localhost, plain HTTP, and an explicit port", () => {
    expect(
      productionClerkAcceptsOrigin(
        { protocol: "http:", hostname: "localhost", port: "4173" },
        liveKey,
      ),
    ).toBe(false);
    expect(
      productionClerkAcceptsOrigin(
        {
          protocol: "https:",
          hostname: "local.resonantprojects.art",
          port: "4173",
        },
        liveKey,
      ),
    ).toBe(false);
    expect(
      productionClerkAcceptsOrigin(
        { protocol: "https:", hostname: "localhost", port: "" },
        liveKey,
      ),
    ).toBe(false);
  });

  it("rejects hosts that only look like the production apex", () => {
    expect(
      productionClerkAcceptsOrigin(
        {
          protocol: "https:",
          hostname: "evilresonantprojects.art",
          port: "",
        },
        liveKey,
      ),
    ).toBe(false);
    expect(
      productionClerkAcceptsOrigin(
        {
          protocol: "https:",
          hostname: "resonantprojects.art.evil.com",
          port: "",
        },
        liveKey,
      ),
    ).toBe(false);
  });

  it("leaves development keys unrestricted", () => {
    expect(
      productionClerkAcceptsOrigin(
        { protocol: "http:", hostname: "localhost", port: "4173" },
        testKey,
      ),
    ).toBe(true);
  });
});

describe("localDevSignInBlocked", () => {
  const localhost = {
    protocol: "http:",
    hostname: "localhost",
    port: "4173",
  };

  it("blocks a live key on localhost during dev", () => {
    expect(
      localDevSignInBlocked({
        dev: true,
        publishableKey: liveKey,
        origin: localhost,
      }),
    ).toBe(true);
  });

  it("keeps the production redirect for live keys outside dev", () => {
    expect(
      localDevSignInBlocked({
        dev: false,
        publishableKey: liveKey,
        origin: localhost,
      }),
    ).toBe(false);
  });

  it("allows the local HTTPS origin", () => {
    expect(
      localDevSignInBlocked({
        dev: true,
        publishableKey: liveKey,
        origin: {
          protocol: "https:",
          hostname: "local.resonantprojects.art",
          port: "",
        },
      }),
    ).toBe(false);
  });
});

describe("localDevSignInUrl", () => {
  it("keeps the path the developer was on", () => {
    expect(
      localDevSignInUrl({
        pathname: "/weekly-turns",
        search: "?draft=1",
        hash: "#notes",
      }),
    ).toBe(`${CLERK_LOCAL_DEV_ORIGIN}/weekly-turns?draft=1#notes`);
  });
});
