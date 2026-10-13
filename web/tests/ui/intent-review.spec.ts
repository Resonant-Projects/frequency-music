import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Fail closed if a fixture accidentally starts calling an external service.
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/tests/ui/index.html");
});

test("immutable payload and repeated confirmation/cancellation taps", async ({
  page,
}) => {
  const confirm = page.getByRole("button", {
    name: "Confirm Save listening feedback",
  });
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  await expect(page.locator("pre")).toContainText('"goosebumps": "not given"');
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await confirm.click();
  // dispatchEvent exercises the synchronous guard despite aria-disabled.
  await confirm.dispatchEvent("click");
  await cancel.dispatchEvent("click");
  await expect(page.getByLabel("Mutation calls")).toHaveText("1");
  await expect(confirm).toHaveAttribute("aria-busy", "true");
  await page.getByRole("button", { name: "Resolve request" }).click();
  await expect(page.locator('p[role="status"]')).toContainText(
    "Waiting for the current decision status",
  );
  await confirm.dispatchEvent("click");
  await expect(page.getByLabel("Mutation calls")).toHaveText("1");
  await page.getByRole("button", { name: "Publish applied status" }).click();
  await expect(page.locator('p[role="status"]')).toHaveText("Applied");
});

test("failed cancellation is visible and can be retried", async ({ page }) => {
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Reject request" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Target changed. Request a new proposal.",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Mutation calls")).toHaveText("2");
});

test("expiry blocks a decision and old async failures do not leak across navigation", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Confirm Save listening feedback" })
    .click();
  await page.getByRole("button", { name: "Open another intent" }).click();
  await page.getByRole("button", { name: "Reject request" }).click();
  await expect(page.getByRole("alert")).toBeEmpty();
  await page.getByRole("button", { name: "Expire proposal" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("expired");
  await page
    .getByRole("button", { name: "Confirm Save listening feedback" })
    .dispatchEvent("click");
  await expect(page.getByLabel("Mutation calls")).toHaveText("1");
});

test("payload fits a phone and keyboard focus remains on submission", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const confirm = page.getByRole("button", {
    name: "Confirm Save listening feedback",
  });
  await confirm.focus();
  await page.keyboard.press("Enter");
  await expect(confirm).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
