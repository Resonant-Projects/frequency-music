import { expect, test, type Page } from "@playwright/test";
import { createRunId, expectNoticeToMatch, waitForRowByText } from "./helpers";

async function createCampaignViaUi(page: Page, title: string) {
  await page.goto("/weekly-turns");
  await page.locator("#campaign-title").fill(title);
  await page.locator("#campaign-question").fill(`Campaign question for ${title}`);
  await page.locator("#campaign-description").fill(
    `Campaign description for ${title}`,
  );
  await page.locator("#campaign-status").selectOption("paused");
  await page.getByRole("button", { name: "Create Campaign" }).click();
  await expect(
    page
      .getByTestId("campaign-card")
      .filter({ has: page.getByDisplayValue(title) })
      .first(),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe("phase three weekly turns", () => {
  test.describe.configure({ mode: "serial" });

  test("creates a campaign-guided brief with persisted studio prompts", async ({
    page,
  }) => {
    test.skip(
      !process.env.RUN_LIVE_BRIEF_E2E,
      "Requires live weekly brief generation with external LLM credentials.",
    );

    const runId = createRunId();
    const thesisTitle = `E2E Thesis ${runId}`;
    const hypothesisTitle = `E2E Phase3 Hypothesis ${runId}`;
    const recipeTitle = `E2E Phase3 Recipe ${runId}`;
    const campaignTitle = `E2E Campaign ${runId}`;

    await test.step("create thesis", async () => {
      await page.goto("/theses");
      await page.locator("#thesis-title").fill(thesisTitle);
      await page
        .locator("#thesis-statement")
        .fill(`A thesis statement for ${runId}`);
      await page
        .getByRole("button", { name: "Create Thesis" })
        .click();
      await expectNoticeToMatch(page, [/Thesis created\./i]);
      await expect(page.getByRole("link", { name: thesisTitle })).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step("create hypothesis attached to thesis", async () => {
      await page.goto("/hypotheses");
      await page.locator("#hyp-title").fill(hypothesisTitle);
      await page.locator("#hyp-question").fill(`Question ${runId}`);
      await page.locator("#hyp-statement").fill(`Hypothesis ${runId}`);
      await page.locator("#hyp-why").fill(`Why this matters ${runId}`);
      await page.locator("#hyp-rationale").fill(`Rationale ${runId}`);
      await page
        .locator("#hyp-thesis")
        .selectOption({ label: thesisTitle });
      await page.getByRole("button", { name: "Create Hypothesis" }).click();
      await expectNoticeToMatch(page, [/Hypothesis created\./i]);
      await waitForRowByText(page, hypothesisTitle);
    });

    await test.step("create recipe", async () => {
      await page.goto("/recipes");
      await page
        .locator("#recipe-hypothesis")
        .selectOption({ label: hypothesisTitle });
      await page.locator("#recipe-title").fill(recipeTitle);
      await page.locator("#recipe-why").fill(`Recipe why ${runId}`);
      await page.locator("#recipe-body").fill(`Recipe body ${runId}`);
      await page.locator("#recipe-params").fill("tempo:108 BPM");
      await page.locator("#recipe-checklist").fill("Print draft");
      await page.getByRole("button", { name: "Create Recipe" }).click();
      await expectNoticeToMatch(page, [/Recipe created\./i]);
      await waitForRowByText(page, recipeTitle);
    });

    await test.step("create active campaign", async () => {
      await page.goto("/weekly-turns");
      await page.locator("#campaign-title").fill(campaignTitle);
      await page.locator("#campaign-question").fill(`Campaign question ${runId}`);
      await page.locator("#campaign-description").fill(`Campaign description ${runId}`);
      await page.locator("#campaign-status").selectOption("active");
      await page.getByRole("button", { name: "Create Campaign" }).click();
      await expectNoticeToMatch(page, [/Campaign created\./i]);
      await expect(page.getByText(campaignTitle).first()).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step("attach thesis to campaign", async () => {
      await page.goto("/theses");
      await page.getByRole("link", { name: thesisTitle }).click();
      await page.locator("select").last().selectOption({ label: campaignTitle });
      await page.getByRole("button", { name: "Attach" }).click();
      await expectNoticeToMatch(page, [/Thesis attached to campaign\./i]);
      await expect(page.getByText(campaignTitle)).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step("generate brief and verify phase three sections", async () => {
      await page.goto("/weekly-turns");
      await page.getByRole("button", { name: "Generate Now" }).click();
      await expectNoticeToMatch(page, [/Weekly turn generated for /i], 60_000);

      await page
        .getByRole("link")
        .filter({ hasText: "campaign" })
        .first()
        .click();

      await expect(page.getByText("Campaign Context")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText("Studio Prompts")).toBeVisible();
      await expect(page.getByText("Recommended Actions")).toBeVisible();
      await expect(page.getByText("10-minute")).toBeVisible();
      await expect(page.getByText("30-minute")).toBeVisible();
      await expect(page.getByText("90-minute")).toBeVisible();
    });
  });

  test("saving an activated campaign keeps it active", async ({ page }) => {
    const runId = createRunId();
    const firstCampaignTitle = `E2E Campaign First ${runId}`;
    const secondCampaignTitle = `E2E Campaign Second ${runId}`;

    await createCampaignViaUi(page, firstCampaignTitle);
    await createCampaignViaUi(page, secondCampaignTitle);

    await page.goto("/weekly-turns");
    const firstCard = page
      .getByTestId("campaign-card")
      .filter({ has: page.getByDisplayValue(firstCampaignTitle) })
      .first();

    await firstCard.getByRole("button", { name: "Set Active" }).click();
    await expectNoticeToMatch(page, [/Active campaign updated\./i]);

    await firstCard.getByRole("button", { name: "Save Campaign" }).click();
    await expectNoticeToMatch(page, [/Campaign updated\./i]);

    await expect(firstCard.locator("select")).toHaveValue("active");
    await expect(
      firstCard.getByRole("button", { name: "Set Active" }),
    ).toHaveCount(0);
  });

  test("older campaigns remain selectable from thesis detail", async ({
    page,
  }) => {
    const runId = createRunId();
    const thesisTitle = `E2E Selection Thesis ${runId}`;
    const oldestCampaignTitle = `E2E Oldest Campaign ${runId}`;

    await page.goto("/theses");
    await page.locator("#thesis-title").fill(thesisTitle);
    await page
      .locator("#thesis-statement")
      .fill(`Selection thesis statement ${runId}`);
    await page.getByRole("button", { name: "Create Thesis" }).click();
    await expectNoticeToMatch(page, [/Thesis created\./i]);
    await expect(page.getByRole("link", { name: thesisTitle })).toBeVisible({
      timeout: 30_000,
    });

    await createCampaignViaUi(page, oldestCampaignTitle);
    for (let index = 0; index < 20; index += 1) {
      await createCampaignViaUi(page, `E2E Newer Campaign ${index + 1} ${runId}`);
    }

    await page.goto("/theses");
    await page.getByRole("link", { name: thesisTitle }).click();
    const campaignSelect = page.getByTestId("thesis-campaign-select");

    await campaignSelect.selectOption({ label: oldestCampaignTitle });
    await page.getByRole("button", { name: "Attach" }).click();
    await expectNoticeToMatch(page, [/Thesis attached to campaign\./i]);
    await expect(page.getByText(oldestCampaignTitle)).toBeVisible({
      timeout: 30_000,
    });
  });
});
