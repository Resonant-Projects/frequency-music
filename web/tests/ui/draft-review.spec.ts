import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
});

test("fetches a terminal deep link with an empty pending queue", async ({
  page,
}) => {
  await page.goto("/agent-drafts?draft=terminal");
  await expect(
    page.getByText("Synthetic terminal", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic recorded decision", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveCount(0);
});

test("queue selection updates URL and history, and remains after retirement", async ({
  page,
}) => {
  await page.goto("/agent-drafts");
  await page.getByRole("button", { name: "Populate queue" }).click();
  await page.getByRole("button", { name: /Summary two/ }).click();
  await expect(page).toHaveURL(/draft=two/);
  await page.getByRole("button", { name: /Summary one/ }).click();
  await page.goBack();
  await expect(page).toHaveURL(/draft=two/);
  await expect(page.getByText("Synthetic two", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retire queue drafts" }).click();
  await expect(page.getByText("Synthetic two", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Synthetic recorded decision", { exact: false }),
  ).toBeVisible();
});

test("invalid and missing targets do not open an unrelated draft", async ({
  page,
}) => {
  await page.goto("/agent-drafts?draft=one&intent=another");
  await expect(
    page.getByText(
      "This review link is invalid. Open the pending queue to continue.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to pending queue" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/draft=|intent=/);
  await expect(
    page.getByRole("heading", { name: "Draft Review Queue" }),
  ).toBeFocused();
  await page.goto("/agent-drafts?draft=missing");
  await expect(
    page.getByText("Unable to load review context: Draft not found"),
  ).toBeVisible();
});

test("returning to a populated queue restores keyboard focus to its selected row", async ({
  page,
}) => {
  await page.goto("/agent-drafts?draft=one");
  await page.getByRole("button", { name: "Populate queue" }).click();
  await page.getByRole("button", { name: "Back to pending queue" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/draft=/);
  await expect(page.getByRole("button", { name: /Summary one/ })).toBeFocused();
});
