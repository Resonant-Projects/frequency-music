import { expect, test } from "@playwright/test";

test.describe("tab ownership", () => {
  test("ingest owns feed controls and does not expose extraction actions", async ({ page }) => {
    await page.goto("/ingest");

    await expect(page.getByRole("heading", { name: "Feed Intake" })).toBeVisible();
    await expect(page.locator("#ingest-feed-name")).toBeVisible();
    await expect(page.locator("#ingest-feed-url")).toBeVisible();
    await expect(page.locator("#ingest-feed-type")).toBeVisible();
    await expect(page.getByRole("button", { name: "Poll Feeds Now" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Run Extraction" })).toHaveCount(0);
  });

  test("admin excludes feed operations and emphasizes override-only controls", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Intake Controls Moved" })).toHaveCount(0);
    await expect(
      page.getByText("Emergency/manual override. For normal source workflow"),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Add Feed" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Poll Feeds Now" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Feed List" })).toHaveCount(0);
  });

  test("display owns source extraction action", async ({ page }) => {
    await page.goto("/display");

    await expect
      .poll(async () => page.getByRole("button", { name: "Run Extraction" }).count(), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
  });
});
