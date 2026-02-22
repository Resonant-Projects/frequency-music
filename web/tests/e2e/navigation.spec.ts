import { expect, test } from "@playwright/test";

const routeHeadings: Array<{ path: string; heading: string }> = [
  { path: "/ingest", heading: "Ingest Console" },
  { path: "/display", heading: "Display & Triage" },
  { path: "/hypotheses", heading: "Hypotheses" },
  { path: "/recipes", heading: "Recipes" },
  { path: "/weekly-turns", heading: "Weekly Turns" },
  { path: "/compositions", heading: "Compositions" },
  { path: "/feedback", heading: "Feedback & Listening Sessions" },
  { path: "/admin", heading: "Admin" },
];

test.describe("navigation", () => {
  test("renders shell and app navigation links", async ({ page }) => {
    await page.goto("/ingest");

    await expect(page.getByText("Frequency Music")).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ingest" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Display" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Hypotheses" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Recipes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Weekly Turns" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Compositions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Feedback" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  });

  for (const route of routeHeadings) {
    test(`loads ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    });
  }

  test("home workspace CTA navigates to a mapped route", async ({ page }) => {
    await page.goto("/");

    const webglError = page.getByText("Error creating WebGL context.");
    const hasWebGlError = await webglError
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (hasWebGlError) {
      test.skip(true, "WebGL is unavailable in this headless environment.");
    }

    await page.getByRole("button", { name: "Open Domain Workspace" }).click();
    await expect(page).toHaveURL(
      /\/(display|ingest|recipes|hypotheses|weekly-turns|compositions)$/,
    );
  });
});
