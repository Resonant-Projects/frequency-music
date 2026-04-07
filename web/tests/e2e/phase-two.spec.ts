import { expect, test } from "@playwright/test";

test.describe("phase two surfaces", () => {
  test("phase two routes and new decision-support sections render", async ({ page }) => {
    await test.step("load theses route", async () => {
      await page.goto("/theses");
      await expect(page.getByRole("heading", { name: "Theses" })).toBeVisible();
    });

    await test.step("verify display page shows editorial signals", async () => {
      await page.goto("/display");
      await expect(page.getByRole("heading", { name: "Editorial Signals" })).toBeVisible();
    });

    await test.step("compositions page renders phase two entry point", async () => {
      await page.goto("/compositions");
      await expect(page.getByRole("heading", { name: "Compositions" })).toBeVisible();
      await expect(page.locator("#composition-revision-parent")).toBeVisible();
    });

    await test.step("failure archive route loads and filters", async () => {
      await page.goto("/failures");
      await expect(page.getByRole("heading", { name: "Failure Archive" })).toBeVisible();
      await page.locator("#failure-reason").selectOption("archived_recipe");
      await expect(page.locator("#failure-reason")).toHaveValue("archived_recipe");
    });
  });
});
