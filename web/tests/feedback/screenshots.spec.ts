// FIXTURE evidence capture: set SHOTS_DIR and SHOTS_LABEL to write screenshots.
import { expect, test } from "@playwright/test";

const dir = process.env.SHOTS_DIR;
const label = process.env.SHOTS_LABEL ?? "after";
const routes = (process.env.SHOTS_ROUTES ?? "/listen,/docket").split(",");
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};
const states = ["ready", "empty", "loading", "error"] as const;

test.skip(!dir, "SHOTS_DIR not set");
for (const route of routes)
  for (const [name, viewport] of Object.entries(viewports))
    for (const state of states)
      test(`${label} ${route} ${name} ${state}`, async ({ page }) => {
        await page.route("**/*", (request) =>
          new URL(request.request().url()).hostname === "127.0.0.1"
            ? request.continue()
            : request.abort(),
        );
        // Fixture state is set before the viewport, per the evidence protocol.
        await page.goto(route);
        await page.waitForFunction(() => "feedbackFixture" in window);
        await page.evaluate(
          (value) => (window as any).feedbackFixture.setState(value),
          state,
        );
        await page.setViewportSize(viewport);
        await expect(page.locator("[data-fixture-banner]")).toBeVisible();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `${dir}/${label}-${route.slice(1)}-${name}-${state}.png`,
          fullPage: true,
        });
      });
