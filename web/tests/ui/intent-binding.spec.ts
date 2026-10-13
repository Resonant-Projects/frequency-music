import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
});

test("real route binds immutable listening payload, digest and stable retry event", async ({
  page,
}) => {
  await page.goto("/agent-drafts?intent=listening");
  await expect(
    page.getByText("bodilyPleasantness: 0", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("goosebumps: not given", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Confirmation digest: abcdef01")).toBeVisible();
  await page.getByRole("button", { name: "Populate queue" }).click();
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveCount(0);
  const confirm = page.getByRole("button", {
    name: "Confirm createListeningSession",
  });
  await confirm.click();
  await expect(confirm).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: "Fail transport" }).click();
  await expect(
    page.getByText("Could not reach the server. Check your connection."),
  ).toBeVisible();
  await confirm.click();
  const calls = JSON.parse(
    (await page.getByLabel("API calls").textContent()) ?? "[]",
  );
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0].args).toMatchObject({
    intentId: "listening",
    digest8: "abcdef01",
  });
  expect(calls[0].args.eventId).toBeTruthy();
  await page.getByRole("button", { name: "Reject domain" }).click();
  await expect(
    page.getByText("Status: rejected", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Target revision changed. Request a new proposal.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(confirm).toHaveAttribute("aria-disabled", "true");
});

test("navigation isolates pending response and cancellation uses its own intent", async ({
  page,
}) => {
  await page.goto("/agent-drafts?intent=listening");
  await page
    .getByRole("button", { name: "Confirm createListeningSession" })
    .click();
  await page.getByRole("link", { name: "Next intent" }).click();
  await expect(
    page.getByRole("heading", { name: "Review decision D-second" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Finish mutation" }).click();
  await expect(
    page.getByText("Status: proposed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const calls = JSON.parse(
    (await page.getByLabel("API calls").textContent()) ?? "[]",
  );
  expect(calls[1].name).toBe("decisionIntents:cancelWeb");
  expect(calls[1].args.intentId).toBe("second");
  expect(calls[1].args.eventId).not.toBe(calls[0].args.eventId);
  await page.getByRole("button", { name: "Finish mutation" }).click();
  await expect(
    page.getByText("Status: cancelled", { exact: true }),
  ).toBeVisible();
});

test("missing, unauthorized, expired and applied intents stay non-actionable", async ({
  page,
}) => {
  for (const [id, message] of [
    ["missing", "Decision not found."],
    ["unauthorized", "Human user mapping required"],
    ["expired", "This proposal has expired."],
    ["applied", "session-one"],
  ]) {
    await page.goto(`/agent-drafts?intent=${id}`);
    await expect(page.getByText(message, { exact: false })).toBeVisible();
    const confirm = page.getByRole("button", {
      name: "Confirm createListeningSession",
    });
    if (await confirm.count())
      await expect(confirm).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByLabel("API calls")).toHaveText("[]");
  }
});

test("terminal draft shows source, transcript and intent reference", async ({
  page,
}) => {
  await page.goto("/agent-drafts?draft=terminal");
  await expect(page.getByText("Decision source: telegram")).toBeVisible();
  await page.getByText("Decision transcript", { exact: true }).click();
  await expect(
    page.getByText("Synthetic transcript from signer"),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Review decision intent listening" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review decision D-listening" }),
  ).toBeVisible();
});

test("subscription terminal status blocks decisions and loading never offers actions", async ({
  page,
}) => {
  await page.goto("/agent-drafts?intent=loading");
  await expect(
    page.getByText("Loading decision...", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm createListeningSession" }),
  ).toHaveCount(0);
  await page.goto("/agent-drafts?intent=listening");
  await page.getByRole("button", { name: "Publish intent rejection" }).click();
  await expect(
    page.getByText("Status: rejected", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm createListeningSession" }),
  ).toHaveAttribute("aria-disabled", "true");
});
