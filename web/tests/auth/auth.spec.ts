import { expect, type Page, test } from "@playwright/test";

const SIGN_IN = "https://accounts.fixture.test/sign-in";

type FixtureLog = {
  clerk: {
    constructed: string[];
    loadOptions: Record<string, unknown>[];
    tokenRequests: { template?: string; skipCache?: boolean }[];
  };
  convex: { setAuthCalls: number; tokens: (string | null)[] };
};

let outboundRequests: string[];

test.beforeEach(async ({ page }) => {
  outboundRequests = [];
  // The hosted sign-in page is answered locally; anything else off this
  // machine (Clerk's CDN scripts in particular) is recorded and refused.
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") return route.continue();
    if (url.origin + url.pathname === SIGN_IN)
      return route.fulfill({ body: "<h1>Hosted sign-in</h1>" });
    outboundRequests.push(url.toString());
    return route.abort();
  });
});

function fixtureLog(page: Page): Promise<FixtureLog> {
  return page.evaluate(
    () => (window as unknown as { authFixture: FixtureLog }).authFixture,
  );
}

const fixtureUrl = (scenario: string) =>
  `/tests/auth/index.html?scenario=${scenario}`;

test("signed-in user sees the app and Convex gets the convex template token", async ({
  page,
}) => {
  await page.goto(fixtureUrl("signed-in"));
  // While clerk-js loads, neither the app nor the sign-in notice shows.
  await expect(page.getByRole("heading")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Protected content" }),
  ).toBeVisible();
  await expect(page.getByTestId("user")).toHaveText("user_fixture");
  await expect
    .poll(async () => (await fixtureLog(page)).convex.tokens)
    .toEqual(["token-for-convex"]);

  const log = await fixtureLog(page);
  expect(log.clerk.constructed).toHaveLength(1);
  expect(log.clerk.loadOptions).toHaveLength(1);
  expect(log.clerk.loadOptions[0]).toMatchObject({
    signInUrl: SIGN_IN,
    signUpUrl: "https://accounts.fixture.test/sign-up",
    signInFallbackRedirectUrl: "/",
    signUpFallbackRedirectUrl: "/",
  });
  expect(log.clerk.tokenRequests).toEqual([
    { template: "convex", skipCache: false },
  ]);
  expect(page.url()).toContain(fixtureUrl("signed-in"));
  expect(outboundRequests).toEqual([]);
});

test("signed-out visitor goes to hosted sign-in with a return URL", async ({
  page,
}) => {
  await page.goto(fixtureUrl("signed-out"));
  await page.waitForURL((url) => url.origin + url.pathname === SIGN_IN);
  const returnTo = new URL(page.url()).searchParams.get("redirect_url");
  expect(returnTo).toBe(
    `http://127.0.0.1:4188/tests/auth/index.html?scenario=signed-out`,
  );
  expect(outboundRequests).toEqual([]);
});

test("signing out sends the user to hosted sign-in", async ({ page }) => {
  await page.goto(fixtureUrl("signed-in"));
  await expect(
    page.getByRole("heading", { name: "Protected content" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.origin + url.pathname === SIGN_IN);
});

test("a clerk-js load failure says sign-in is unavailable instead of redirecting", async ({
  page,
}) => {
  await page.goto(fixtureUrl("fail"));
  await expect(
    page.getByRole("heading", { name: "Sign-in is unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Protected content" }),
  ).toHaveCount(0);
  expect(page.url()).toContain(fixtureUrl("fail"));
  expect((await fixtureLog(page)).convex.tokens).toEqual([]);
  expect(outboundRequests).toEqual([]);
});
