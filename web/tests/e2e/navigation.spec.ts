import { expect, test } from "@playwright/test";

const routeHeadings: Array<{ path: string; heading: string }> = [
  { path: "/ingest", heading: "Ingest Console" },
  { path: "/display", heading: "Display & Triage" },
  { path: "/essays", heading: "Essays" },
  { path: "/hypotheses", heading: "Hypotheses" },
  { path: "/theses", heading: "Theses" },
  { path: "/recipes", heading: "Recipes" },
  { path: "/weekly-turns", heading: "Weekly Turns" },
  { path: "/compositions", heading: "Compositions" },
  { path: "/failures", heading: "Failure Archive" },
  { path: "/feedback", heading: "Feedback & Listening Sessions" },
  { path: "/agent-runs", heading: "Agent Runs" },
  { path: "/admin", heading: "Admin" },
];

test.describe("navigation", () => {
  test("renders shell and app navigation links", async ({ page }) => {
    await page.goto("/ingest");

    await expect(page.getByText("Frequency Music")).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ingest" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Display" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Essays" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Hypotheses" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Theses", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Recipes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Weekly Turns" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Compositions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Failures", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Feedback" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Agent Runs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  });

  for (const route of routeHeadings) {
    test(`loads ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    });
  }

  test("home workspace shortcuts include full workflow routes", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByTestId("home-workspace-link").filter({ hasText: "Essays" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("home-workspace-link").filter({ hasText: "Feedback" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("home-workspace-link").filter({ hasText: "Admin" }),
    ).toBeVisible();

    await page.getByTestId("home-workspace-link").filter({ hasText: "Admin" }).first().click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/");
    await page.getByTestId("home-workspace-link").filter({ hasText: "Display" }).first().click();
    await expect(page).toHaveURL(/\/display$/);
  });
});
