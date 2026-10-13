import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/tests/listen/index.html");
});

test("uses authorized playback and updates target on navigation", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Listen", exact: true }),
  ).toBeVisible();
  await expect(page.locator("audio")).toHaveAttribute(
    "src",
    "/synthetic-audio.mp3",
  );
  await expect(page.locator("audio")).toHaveAttribute("preload", "none");
  await expect(
    page.getByRole("heading", { name: /Study one\s*0:12/ }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as any).listenFixture.setKind("composition"),
  );
  const requests = await page.evaluate(
    () => (window as any).listenFixture.requests,
  );
  expect(requests).toContainEqual({
    name: "audioArtifacts:listReadyForTarget",
    args: { target: { kind: "recipe", id: "recipe-one" } },
  });
  expect(requests).toContainEqual({
    name: "audioArtifacts:listReadyForTarget",
    args: { target: { kind: "composition", id: "composition-one" } },
  });
  expect(requests).toContainEqual({
    name: "audioArtifacts:playback",
    args: { artifactId: "audio-one" },
  });
});

test("empty and error states remove the section and stale audio", async ({
  page,
}) => {
  for (const state of ["empty", "error", "loading"]) {
    await page.evaluate(
      (state) => (window as any).listenFixture.setState(state),
      state,
    );
    await expect(page.locator("audio")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Listen", exact: true }),
    ).toHaveCount(0);
    if (state === "error")
      await expect(
        page.getByText("Unable to load audio: Authentication required"),
      ).toBeVisible();
    if (state === "loading")
      await expect(page.getByText("Loading audio...")).toBeVisible();
  }
});

test("revoked playback removes player and title", async ({ page }) => {
  await page.evaluate(() =>
    (window as any).listenFixture.setState("unavailable"),
  );
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(page.getByText("Study one")).toHaveCount(0);
  await expect(page.getByText("Audio not found.")).toBeVisible();
});
