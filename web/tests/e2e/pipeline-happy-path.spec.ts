import { expect, test } from "@playwright/test";
import { createRunId, expectNoticeToMatch, waitForRowByText } from "./helpers";

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("pipeline happy path", () => {
  test.describe.configure({ mode: "serial" });

  test("creates and advances core records across routes", async ({ page }) => {
    const runId = createRunId();
    const sourceTitle = `E2E Source ${runId}`;
    const sourceUrl = `https://example.com/${runId}`;
    const hypothesisTitle = `E2E Hypothesis ${runId}`;
    const recipeTitle = `E2E Recipe ${runId}`;
    const compositionTitle = `E2E Composition ${runId}`;
    const feedbackNotes = `E2E feedback ${runId}`;
    const feedName = `E2E Feed ${runId}`;
    const feedUrl = `https://example.com/${runId}/feed.xml`;

    await test.step("ingest URL source", async () => {
      await page.goto("/ingest");

      await page.locator("#url-input-url").fill(sourceUrl);
      await page.locator("#url-input-title").fill(sourceTitle);
      await page.locator("#url-input-tags").fill(`e2e,${runId}`);
      await page
        .locator("#url-input-raw-text")
        .fill(`E2E ingest payload for ${runId}`);
      await page.getByRole("button", { name: "Ingest URL" }).click();

      await expectNoticeToMatch(page, [
        /URL source ingested into private inbox\./i,
        /URL updated from latest ingest payload\./i,
      ]);
    });

    await test.step("triage source in display queue", async () => {
      await page.goto("/display");

      const sourceRow = page
        .getByTestId("display-row")
        .filter({ hasText: sourceTitle })
        .first();
      await expect(sourceRow).toBeVisible({ timeout: 30_000 });

      const triageButton = sourceRow.getByRole("button", {
        name: "Mark Triaged",
      });
      await expect(triageButton).toBeVisible({ timeout: 30_000 });
      await triageButton.click();

      await expectNoticeToMatch(page, [/Source marked as triaged\./i]);
    });

    await test.step("create hypothesis", async () => {
      await page.goto("/hypotheses");

      await page.locator("#hyp-title").fill(hypothesisTitle);
      await page
        .locator("#hyp-question")
        .fill(`Does ${runId} improve clarity in constrained harmonic drift?`);
      await page
        .locator("#hyp-statement")
        .fill(
          `If ${runId} keeps a stable anchor, perceived cohesion should increase.`,
        );
      await page.locator("#hyp-rationale").fill(`Rationale for ${runId}`);

      const citation = page
        .locator("label")
        .filter({ hasText: sourceTitle })
        .first();
      try {
        await expect(citation).toBeVisible({ timeout: 5_000 });
        await citation.click();
      } catch (error) {
        if (!(error instanceof Error && error.name === "TimeoutError")) {
          throw error;
        }
        // Citation selection is optional for this happy-path suite.
      }

      await page.getByRole("button", { name: "Create Hypothesis" }).click();
      await expectNoticeToMatch(page, [/Hypothesis created\./i]);
      await waitForRowByText(page, hypothesisTitle);
    });

    await test.step("create recipe from hypothesis", async () => {
      await page.goto("/recipes");

      await expect
        .poll(
          async () =>
            page
              .locator("#recipe-hypothesis option")
              .filter({ hasText: hypothesisTitle })
              .count(),
          { timeout: 30_000 },
        )
        .toBeGreaterThan(0);
      await page
        .locator("#recipe-hypothesis")
        .selectOption({ label: hypothesisTitle });

      await page.locator("#recipe-title").fill(recipeTitle);
      await page.locator("#recipe-body").fill(`Recipe body for ${runId}`);
      await page.locator("#recipe-params").fill("tempo:108 BPM\nrootNote:C");
      await page
        .locator("#recipe-checklist")
        .fill("Set tempo\nPrint version A");

      await page.getByRole("button", { name: "Create Recipe" }).click();
      await expectNoticeToMatch(page, [/Recipe created\./i]);
      await waitForRowByText(page, recipeTitle);
    });

    await test.step("create composition and set rendered status", async () => {
      await page.goto("/compositions");

      await expect
        .poll(
          async () =>
            page
              .locator("#composition-recipe option")
              .filter({ hasText: recipeTitle })
              .count(),
          { timeout: 30_000 },
        )
        .toBeGreaterThan(0);
      await page.locator("#composition-title").fill(compositionTitle);
      await page
        .locator("#composition-recipe")
        .selectOption({ label: recipeTitle });

      await page.getByRole("button", { name: "Create Composition" }).click();
      await expectNoticeToMatch(page, [/Composition created\./i]);

      const compositionRow = await waitForRowByText(page, compositionTitle);
      await compositionRow.getByRole("button", { name: "Rendered" }).click();
      await expectNoticeToMatch(page, [/Composition set to rendered\./i]);
    });

    await test.step("log listening feedback", async () => {
      await page.goto("/feedback");

      await expect
        .poll(
          async () =>
            page
              .locator("#feedback-composition option")
              .filter({ hasText: compositionTitle })
              .count(),
          { timeout: 30_000 },
        )
        .toBeGreaterThan(0);
      await page
        .locator("#feedback-composition")
        .selectOption({ label: compositionTitle });

      await page.locator("#feedback-participants").fill("self, collaborator");
      await page
        .locator("#feedback-context")
        .fill(`Headphones session ${runId}`);
      await page.locator("#feedback-notes").fill(feedbackNotes);

      await page.getByRole("button", { name: "Log Session" }).click();
      await expectNoticeToMatch(page, [/Listening session logged\./i]);
      await expect(page.getByText(feedbackNotes)).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step("create and toggle feed in admin", async () => {
      await page.goto("/admin");

      await page.locator("#admin-feed-name").fill(feedName);
      await page.locator("#admin-feed-url").fill(feedUrl);
      await page.locator("#admin-feed-type").selectOption("rss");
      await page.getByRole("button", { name: "Add Feed" }).click();

      await expectNoticeToMatch(page, [/Feed created\./i]);

      const feedNameParagraph = page
        .locator("p")
        .filter({ hasText: new RegExp(`^${escapeForRegex(feedName)}$`) })
        .first();
      await expect(feedNameParagraph).toBeVisible({ timeout: 30_000 });

      const feedRow = feedNameParagraph.locator("xpath=ancestor::div[2]");
      await expect(feedRow).toBeVisible({ timeout: 30_000 });

      const toggleButton = feedRow
        .getByRole("button", { name: /Disable|Enable/ })
        .first();
      const previousLabel =
        (await toggleButton.textContent())?.trim() ?? "Disable";
      const expectedLabel = previousLabel === "Disable" ? "Enable" : "Disable";

      await toggleButton.click();
      await expect(toggleButton).toHaveText(expectedLabel, { timeout: 30_000 });

      await expectNoticeToMatch(page, [/Feed state updated\./i]);
    });

    await test.step("verify weekly turns route renders", async () => {
      await page.goto("/weekly-turns");
      await expect(
        page.getByRole("heading", { name: "Weekly Turns" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Generate Now" }),
      ).toBeVisible();
    });
  });
});
