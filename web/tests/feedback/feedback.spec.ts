// FIXTURE behavior proof: real routes, synthetic Convex adapter, no backend.
import { expect, type Page, test } from "@playwright/test";

async function open(page: Page, path: string) {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.goto(path);
  await page.waitForFunction(() => "feedbackFixture" in window);
}
const fixture = (page: Page, fn: string, value?: string) =>
  page.evaluate(
    ([f, v]) => (window as any).feedbackFixture[f!](v),
    [fn, value],
  );
const calls = (page: Page) =>
  page.evaluate(() => (window as any).feedbackFixture.calls);
const render = (page: Page) =>
  page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: /7-limit triad drift/ }),
  });

test("kind-specific optional scores keep zero and omit blanks", async ({
  page,
}) => {
  await open(page, "/listen");
  await expect(page.getByRole("heading", { name: "Rate audio" })).toBeVisible();
  const item = render(page);
  await expect(item.getByLabel("Goosebumps")).toBeVisible();
  await expect(item.getByLabel("Pacing")).toHaveCount(0);
  const episode = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: /Weekly Turn episode/ }),
  });
  await expect(episode.getByLabel("Pacing")).toBeVisible();
  await expect(episode.getByLabel("Goosebumps")).toHaveCount(0);
  await item.getByLabel("Overall").fill("0");
  await item.getByLabel("Listened on").selectOption("headphones");
  await item.getByLabel("Time of day").fill("evening");
  await item.getByRole("button", { name: "Save rating" }).click();
  await expect(
    page.getByText(
      "Saved your rating of “Litmus render: 7-limit triad drift”.",
    ),
  ).toBeVisible();
  await expect(render(page)).toHaveCount(0);
  const [call] = await calls(page);
  expect(call).toMatchObject({
    name: "audioFeedback:submit",
    args: {
      artifactId: "render-one",
      contentHash: "render-hash",
      payload: {
        scores: { overall: 0 },
        conditions: { listeningMethod: "headphones", timeOfDay: "evening" },
      },
    },
  });
  expect(Object.keys(call.args.payload.scores)).toEqual(["overall"]);
});

test("invalid, half-recorded and empty submissions never reach the server", async ({
  page,
}) => {
  await open(page, "/listen");
  const item = render(page);
  const save = item.getByRole("button", { name: "Save rating" });
  await save.click();
  await expect(
    item.getByText("Give at least one score or a note."),
  ).toBeVisible();
  await item.getByLabel("Musicality").fill("7");
  await save.click();
  await expect(
    item.getByText("Musicality needs a whole number from 0 to 5."),
  ).toBeVisible();
  await expect(item.getByLabel("Musicality")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await item.getByLabel("Musicality").fill("3");
  await item.getByLabel("Listened on").selectOption("car");
  await save.click();
  await expect(
    item.getByText("Record both how and when you listened, or neither."),
  ).toBeVisible();
  expect(await calls(page)).toEqual([]);
});

test("transport retry reuses the request ID; a stale answer spends it", async ({
  page,
}) => {
  await open(page, "/listen");
  const item = render(page);
  await item.getByLabel("Notes").fill("Beating is audible");
  await fixture(page, "setMode", "network");
  await item.getByRole("button", { name: "Save rating" }).click();
  await expect(item.getByText(/network|connection/i)).toBeVisible();
  await fixture(page, "setMode", "stale");
  await item.getByRole("button", { name: "Save rating" }).click();
  await expect(
    item.getByText(
      "This audio changed since you opened it. Reload and listen again.",
    ),
  ).toBeVisible();
  await fixture(page, "setMode", "ok");
  await item.getByRole("button", { name: "Save rating" }).click();
  await expect(render(page)).toHaveCount(0);
  const ids = (await calls(page)).map((c: any) => c.args.clientRequestId);
  expect(ids[0]).toBe(ids[1]);
  expect(ids[2]).not.toBe(ids[1]);
  expect((await calls(page))[0].args.payload).toEqual({
    scores: {},
    notes: "Beating is audible",
  });
});

test("a pending save blocks a second click", async ({ page }) => {
  await open(page, "/listen");
  const item = render(page);
  await item.getByLabel("Overall").fill("4");
  await fixture(page, "setMode", "hold");
  const save = item.getByRole("button", { name: "Save rating" });
  await save.click();
  await expect(save).toHaveAttribute("aria-busy", "true");
  await save.click();
  await fixture(page, "releaseHeld");
  await expect(render(page)).toHaveCount(0);
  expect(await calls(page)).toHaveLength(1);
});

test("Listen deferral signs the matching docket card version", async ({
  page,
}) => {
  await open(page, "/listen");
  await render(page).getByRole("button", { name: "Defer two weeks" }).click();
  await expect(
    page.getByText(
      "Deferred “Litmus render: 7-limit triad drift” for two weeks.",
    ),
  ).toBeVisible();
  const [call] = await calls(page);
  expect(call).toMatchObject({
    name: "decisionIntents:deferWeb",
    args: { targetId: "render-one", contentHash: "c".repeat(64) },
  });
});

test("Listen loading, empty and error states", async ({ page }) => {
  await open(page, "/listen");
  await fixture(page, "setState", "loading");
  await expect(page.getByText("Loading audio to rate...")).toBeVisible();
  await fixture(page, "setState", "empty");
  await expect(page.getByText("Nothing is waiting to be rated.")).toBeVisible();
  await fixture(page, "setState", "error");
  await expect(
    page.getByText("Unable to load audio to rate: Authentication required"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save rating" })).toHaveCount(
    0,
  );
});

test("docket lists cards, links their pages and defers with a stable event", async ({
  page,
}) => {
  await open(page, "/docket");
  await expect(
    page.getByRole("heading", { name: "Docket", level: 1 }),
  ).toBeVisible();
  const recipe = page.getByRole("article", {
    name: "Recipe: slow beating study",
  });
  await expect(
    recipe.getByRole("link", { name: "Open recipe" }),
  ).toHaveAttribute("href", "/recipes/recipe-one");
  await expect(
    page
      .getByRole("article", { name: /7-limit triad drift/ })
      .getByRole("link", { name: "Rate on Listen" }),
  ).toHaveAttribute("href", "/listen");
  await fixture(page, "setMode", "network");
  await recipe.getByRole("button", { name: "Defer two weeks" }).click();
  await expect(recipe.getByText(/network|connection/i)).toBeVisible();
  await fixture(page, "setMode", "ok");
  await recipe.getByRole("button", { name: "Defer two weeks" }).click();
  await expect(
    page.getByText("Deferred “Recipe: slow beating study” for two weeks."),
  ).toBeVisible();
  await expect(recipe).toHaveCount(0);
  const [first, second] = await calls(page);
  expect(first.args).toEqual(second.args);
  expect(first.args).toMatchObject({
    targetId: "recipe-one",
    contentHash: "b".repeat(64),
  });
});

test("docket stale card, loading, empty and error states", async ({ page }) => {
  await open(page, "/docket");
  await fixture(page, "setMode", "stale");
  const draft = page.getByRole("article", { name: /just-intonation fatigue/ });
  await draft.getByRole("button", { name: "Defer two weeks" }).click();
  await expect(
    draft.getByText("Docket card changed or is no longer eligible"),
  ).toBeVisible();
  await fixture(page, "setState", "loading");
  await expect(page.getByText("Loading the docket...")).toBeVisible();
  await fixture(page, "setState", "empty");
  await expect(page.getByText("Nothing is waiting on you.")).toBeVisible();
  await fixture(page, "setState", "error");
  await expect(
    page.getByText("Unable to load the docket: Authentication required"),
  ).toBeVisible();
});
