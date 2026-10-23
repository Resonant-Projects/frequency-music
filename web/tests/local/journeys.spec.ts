import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { makeFunctionReference } from "convex/server";
import { localClient, readRun } from "../../../scripts/local-convex/client.mjs";

const run = process.env.LOCAL_CONVEX_RUN!;
const { directory, info } = readRun(run);
const identity = JSON.parse(
  readFileSync(resolve(directory, "identity.json"), "utf8"),
);
// Independent HTTP reader; saves go through browser controls and WebSockets.
const reader = localClient(run, identity);
const snapshot = () =>
  reader.query(makeFunctionReference("localVerification:snapshot"), {});
const title = (kind: string) => `Local ${kind} ${run}`;
// These journeys share the URL-intake source created by the first test.
test.describe.configure({ mode: "serial" });
let forbidden: string[];
let pageErrors: string[];
test.beforeEach(async ({ page }) => {
  forbidden = [];
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const allowed = [info.frontend, info.backend, info.site];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (allowed.includes(url.origin)) return route.continue();
    forbidden.push(url.origin + url.pathname);
    return route.abort();
  });
  await page.routeWebSocket("**/*", (ws) => {
    const origin = new URL(ws.url()).origin.replace(/^ws/, "http");
    if (allowed.includes(origin)) return ws.connectToServer();
    forbidden.push(origin);
    ws.close();
  });
});
// biome-ignore lint/correctness/noEmptyPattern: Playwright requires the fixtures object pattern.
test.afterEach(async ({}, testInfo) => {
  writeFileSync(
    resolve(directory, `snapshot-${testInfo.testId}.json`),
    JSON.stringify(await snapshot(), null, 2),
  );
  expect(
    forbidden,
    "only owned localhost services may receive browser traffic",
  ).toEqual([]);
  expect(pageErrors).toEqual([]);
});
async function capture(page: Page, name: string) {
  await page.screenshot({
    path: resolve(directory, name + ".png"),
    fullPage: true,
  });
}

test("URL intake and dedupe persist without requesting generation", async ({
  page,
}) => {
  await page.goto("/ingest");
  const url = `https://example.invalid/${run}`;
  await page.locator("#url-input-url").fill(url);
  await page.locator("#url-input-title").fill(title("Source"));
  await page.locator("#url-input-tags").fill(`local-proof,${run}`);
  await page.getByRole("button", { name: "Ingest URL", exact: true }).click();
  await expect(
    page.getByText("URL source ingested into private inbox.", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (await snapshot()).sources.filter((r: any) => r.canonicalUrl === url),
    )
    .toHaveLength(1);
  const saved = (await snapshot()).sources.find(
    (r: any) => r.canonicalUrl === url,
  );
  expect(saved).toMatchObject({
    title: title("Source"),
    visibility: "private",
    createdBy: identity.subject,
  });
  await capture(page, "01-url-saved");
  // URL-only admission: no fetch, extraction, or provider-output claim.
  await page.locator("#url-input-url").fill(url);
  await page.locator("#url-input-title").fill(title("Source"));
  await page.getByRole("button", { name: "Ingest URL", exact: true }).click();
  await expect(
    page.getByText("URL unchanged; no new extraction queued.", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (await snapshot()).sources
        .filter((r: any) => r.canonicalUrl === url)
        .map((r: any) => r._id),
    )
    .toEqual([saved._id]);
});

test("recover missing source text through the real Display form", async ({
  page,
}) => {
  await page.goto("/display");
  const row = page
    .getByTestId("display-row")
    .filter({ hasText: "Local recovery seed" });
  await row
    .getByRole("button", { name: "Provide text for Local recovery seed" })
    .click();
  await row.getByLabel("What are you providing?").selectOption("article");
  const text =
    "This synthetic article describes a controlled listening study with two sustained tones. Participants compare a stable reference against a small frequency change and record their own perceived beating, musicality, and bodily response without medical claims or inferred scientific results.";
  await row.getByLabel("Source text", { exact: true }).fill(text);
  await row
    .getByRole("button", { name: "Save source text", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await snapshot()).sources.find(
          (r: any) => r.title === "Local recovery seed",
        )?.status,
    )
    .toBe("text_ready");
  const saved = (await snapshot()).sources.find(
    (r: any) => r.title === "Local recovery seed",
  );
  expect(saved.rawText).toBe(
    "Capture supplied during source recovery. Supplied article text. Coverage is limited to the text below.\n" +
      "Evidence URL: https://example.invalid/local-recovery\n\n" +
      text,
  );
  expect(saved.blockedReason).toBeUndefined();
  expect(saved.createdBy).toBe(identity.subject);
  await capture(page, "02-recovery-saved");
});

test("manual hypothesis recipe composition and Listening Session preserve lineage", async ({
  page,
}) => {
  await page.goto("/hypotheses");
  await page.locator("#hyp-title").fill(title("Hypothesis"));
  await page
    .locator("#hyp-question")
    .fill("Does a stable anchor change perceived cohesion?");
  await page
    .locator("#hyp-statement")
    .fill(
      "A stable anchor may increase perceived cohesion in this synthetic study.",
    );
  await page
    .locator("#hyp-why")
    .fill("A bounded synthetic manual workflow for local verification.");
  await page
    .locator("#hyp-rationale")
    .fill("Synthetic rationale; no scientific acceptance is implied.");
  await page.getByLabel(title("Source"), { exact: false }).check();
  await page
    .getByRole("button", { name: "Create Hypothesis", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await snapshot()).hypotheses.find(
          (r: any) => r.title === title("Hypothesis"),
        )?.title,
    )
    .toBe(title("Hypothesis"));
  const hypothesis = (await snapshot()).hypotheses.find(
    (r: any) => r.title === title("Hypothesis"),
  );
  const source = (await snapshot()).sources.find(
    (r: any) => r.title === title("Source"),
  );
  expect(hypothesis.sourceIds).toContain(source._id);
  await capture(page, "03-hypothesis-saved");
  await page.goto("/recipes");
  await page
    .locator("#recipe-hypothesis")
    .selectOption({ label: title("Hypothesis") });
  await page.locator("#recipe-title").fill(title("Recipe"));
  await page
    .locator("#recipe-why")
    .fill("Make one synthetic manual study protocol.");
  await page
    .locator("#recipe-body")
    .fill(
      "Hold an anchor and vary one frequency. Record subjective listening notes.",
    );
  await page.locator("#recipe-params").fill("tempo:108 BPM\nrootNote:C");
  await page.locator("#recipe-checklist").fill("Set tempo\nPrint version A");
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await snapshot()).recipes.find((r: any) => r.title === title("Recipe"))
          ?.hypothesisId,
    )
    .toBe(hypothesis._id);
  const recipe = (await snapshot()).recipes.find(
    (r: any) => r.title === title("Recipe"),
  );
  expect(recipe.parameters).toContainEqual({ type: "tempo", value: "108 BPM" });
  await capture(page, "04-recipe-saved");
  await page.goto("/compositions");
  await page.locator("#composition-title").fill(title("Composition"));
  await page
    .locator("#composition-recipe")
    .selectOption({ label: title("Recipe") });
  await page
    .getByRole("button", { name: "Create Composition", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await snapshot()).compositions.find(
          (r: any) => r.title === title("Composition"),
        )?.recipeId,
    )
    .toBe(recipe._id);
  const composition = (await snapshot()).compositions.find(
    (r: any) => r.title === title("Composition"),
  );
  const row = page
    .getByTestId("entity-row")
    .filter({ hasText: title("Composition") });
  await row
    .getByRole("button", {
      name: `Set ${title("Composition")} to rendered`,
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await snapshot()).compositions.find(
          (r: any) => r._id === composition._id,
        )?.status,
    )
    .toBe("rendered");
  await capture(page, "05-composition-saved");
  await page.goto("/feedback");
  await page
    .locator("#feedback-composition")
    .selectOption({ label: title("Composition") });
  await page.locator("#feedback-participants").fill("Synthetic listener");
  await page
    .locator("#feedback-context")
    .fill("Synthetic local session; no real audio was judged.");
  await page.locator("#feedback-notes").fill(title("Listening notes"));
  await page.locator("#feedback-musicality").fill("3");
  await page.getByRole("button", { name: "Log Session", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await snapshot()).listeningSessions.find(
          (r: any) => r.feedbackMd === title("Listening notes"),
        )?.compositionId,
    )
    .toBe(composition._id);
  const session = (await snapshot()).listeningSessions.find(
    (r: any) => r.feedbackMd === title("Listening notes"),
  );
  expect(session).toMatchObject({
    createdBy: identity.subject,
    visibility: "private",
    ratings: { musicality: 3 },
  });
  await page.reload();
  await expect(
    page.getByText(title("Listening notes"), { exact: true }),
  ).toBeVisible();
  await capture(page, "06-listening-saved");
  await page.goto(`/compositions/${composition._id}`);
  await expect(
    page.getByText(title("Recipe"), { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(title("Hypothesis"), { exact: true }).first(),
  ).toBeVisible();
  await capture(page, "07-lineage");
});

test("feed creation and toggling persist without polling", async ({ page }) => {
  await page.goto("/ingest");
  await page.locator("#ingest-feed-name").fill(title("Feed"));
  await page
    .locator("#ingest-feed-url")
    .fill(`https://example.invalid/${run}/feed.xml`);
  await page.locator("#ingest-feed-type").selectOption("rss");
  await page.getByRole("button", { name: "Add Feed", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await snapshot()).feeds.find((r: any) => r.name === title("Feed"))
          ?.enabled,
    )
    .toBe(true);
  const row = page
    .getByTestId("ingest-feed-row")
    .filter({ hasText: title("Feed") });
  await row
    .getByRole("button", { name: `Disable feed ${title("Feed")}`, exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await snapshot()).feeds.find((r: any) => r.name === title("Feed"))
          ?.enabled,
    )
    .toBe(false);
  await page.reload();
  await expect(
    row.getByRole("button", {
      name: `Enable feed ${title("Feed")}`,
      exact: true,
    }),
  ).toBeVisible();
  await capture(page, "08-feed-disabled");
});
