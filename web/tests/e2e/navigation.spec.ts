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
    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
    });
    await expect(
      navigation.getByRole("link", { name: "Home", exact: true }),
    ).toBeVisible();
    for (const [group, names] of [
      [
        "Research",
        [
          "Ingest",
          "Display",
          "Hypotheses",
          "Theses",
          "Correspondences",
          "Triage",
        ],
      ],
      ["Compose", ["Recipes", "Compositions", "Feedback", "Listen", "Docket"]],
      ["Library", ["Essays", "Weekly Turns", "Editorial", "Failures"]],
      ["Operations", ["Agent Runs", "Review Queue", "Admin"]],
    ] as const) {
      await navigation
        .getByRole("button", { name: group, exact: true })
        .click();
      for (const name of names)
        await expect(
          navigation.locator("a").filter({
            has: page.locator("span", { hasText: new RegExp(`^${name}$`) }),
          }),
        ).toBeVisible();
    }
    await navigation
      .getByRole("button", { name: "Compose", exact: true })
      .click();
    await expect(
      navigation.getByRole("link", { name: /^Docket/ }),
    ).toHaveAttribute("href", "/docket");
    await page.keyboard.press("Escape");
    await expect(navigation.locator(".app-menu-panel:visible")).toHaveCount(0);
    await navigation
      .getByRole("button", { name: "Research", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      navigation.locator('.app-menu-panel[data-state="open"]'),
    ).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(
      navigation.locator(".app-menu-panel:visible a").first(),
    ).toBeFocused();
    await page.keyboard.press("Escape");
  });

  for (const route of routeHeadings) {
    test(`loads ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(
        page.getByRole("heading", { name: route.heading }),
      ).toBeVisible();
    });
  }

  test("dropdowns share the active trigger border at desktop and mobile sizes", async ({
    page,
  }) => {
    await page.goto("/");
    for (const width of [1440, 851, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const names =
        width > 850
          ? ["Research", "Compose", "Library", "Operations"]
          : ["Open navigation menu"];
      for (const name of names) {
        const trigger = page.getByRole("button", { name, exact: true });
        await trigger.click();
        const panel = page.locator('.app-menu-panel[data-state="open"]');
        await expect(panel).toBeVisible();
        const triggerBox = (await trigger.boundingBox())!;
        const panelBox = (await panel.boundingBox())!;
        expect(
          Math.abs(panelBox.y - (triggerBox.y + triggerBox.height - 1)),
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(
            panelBox.x + panelBox.width - (triggerBox.x + triggerBox.width),
          ),
        ).toBeLessThanOrEqual(1);
        expect(panelBox.x).toBeGreaterThanOrEqual(0);
        expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(width);
        await trigger.hover();
        expect(
          await trigger.evaluate((element) => {
            const style = getComputedStyle(element);
            const panel =
              element.parentElement!.querySelector(".app-menu-panel")!;
            return (
              style.backgroundColor ===
                getComputedStyle(panel).backgroundColor &&
              style.borderBottomColor === style.backgroundColor
            );
          }),
        ).toBe(true);
        await page.keyboard.press("Escape");
        await expect(page.locator(".app-menu-panel:visible")).toHaveCount(0);
      }
    }
  });

  test("home uses the shell for workflow navigation", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Workspaces", exact: true }),
    ).toHaveCount(0);
    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
    });
    await navigation
      .getByRole("button", { name: "Operations", exact: true })
      .click();
    await navigation.getByRole("link", { name: /^Admin/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(navigation.locator(".app-menu-panel:visible")).toHaveCount(0);
    await page.goto("/");
    await navigation
      .getByRole("button", { name: "Research", exact: true })
      .click();
    await navigation.getByRole("link", { name: /^Display/ }).click();
    await expect(page).toHaveURL(/\/display$/);
  });
  test("space fills the viewport and selection opens a dismissible inspector", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".atlas-layer-bar")).toBeVisible();
    const inspector = page.getByRole("complementary", {
      name: "Connection inspector",
      includeHidden: true,
    });
    await expect(inspector).toBeHidden();
    await expect(
      page.locator(
        ".atlas-heading, .atlas-domains, .atlas-coverage, .atlas-pipeline, .atlas-inspector-bar",
      ),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.abs(document.documentElement.scrollHeight - window.innerHeight),
        ),
      )
      .toBeLessThanOrEqual(1);
    await page
      .getByRole("button", { name: "Explore Geometry", exact: true })
      .click();
    await expect(inspector).toBeVisible();
    await expect(
      inspector.getByRole("heading", { name: "Geometry", exact: true }),
    ).toBeFocused();
    const footer = inspector.locator(".atlas-inspector-footer");
    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.abs(
            document.querySelector(".atlas-layer-bar")!.getBoundingClientRect()
              .top -
              document
                .querySelector(".atlas-inspector-footer")!
                .getBoundingClientRect().top,
          ),
        ),
      )
      .toBeLessThanOrEqual(1);
    await expect
      .poll(() =>
        footer.evaluate((element) =>
          Math.abs(element.getBoundingClientRect().bottom - innerHeight),
        ),
      )
      .toBeLessThanOrEqual(1);
    await inspector.locator(".atlas-inspector-content").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(
      inspector.getByRole("button", { name: "Back to overview" }),
    ).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(inspector).toBeHidden();
    await expect(page.locator(".knowledge-atlas :focus-visible")).toHaveCount(
      0,
    );
    await expect(page.locator(".atlas-space-label.is-selected")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Explore Geometry", exact: true })
      .click();
    await inspector.getByRole("button", { name: "Back to overview" }).click();
    await expect(inspector).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Explore Geometry", exact: true }),
    ).toBeFocused();
  });

  test("header search opens the space from another route", async ({ page }) => {
    await page.goto("/essays");
    await page
      .getByRole("button", { name: "Search Frequency", exact: true })
      .click();
    const input = page.getByRole("combobox", { name: "Search Frequency" });
    await expect(input).toBeFocused();
    await input.fill("Geometry");
    await page
      .locator(".site-search-results a")
      .filter({ hasText: /^Geometrydomain$/ })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".atlas-selection h2")).toHaveText("Geometry");
    await expect(page.locator(".atlas-inspector")).toBeVisible();
    await expect(input).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.locator(".atlas-inspector")).toBeHidden();
    await page
      .getByRole("button", { name: "Search Frequency", exact: true })
      .click();
    await input.fill("Essays");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/essays$/);
  });

  for (const shortcut of ["Meta+k", "Control+k"]) {
    test(`${shortcut} opens a keyboard search palette from any page`, async ({
      page,
    }) => {
      await page.goto("/essays");
      await expect(
        page.getByRole("button", { name: "Search Frequency", exact: true }),
      ).toBeVisible();
      await page.keyboard.press(shortcut);
      const dialog = page.getByRole("dialog", { name: "Search Frequency" });
      const input = dialog.getByRole("combobox", { name: "Search Frequency" });
      await expect(dialog).toBeVisible();
      await expect(page.locator(".site-search-panel:modal")).toHaveCount(1);
      await expect(input).toBeFocused();
      await input.fill("es");
      await expect(
        dialog.getByRole("option", { name: "Essays Page", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("ArrowDown");
      await expect(input).toBeFocused();
      await expect(dialog.getByRole("option", { selected: true })).toHaveCount(
        1,
      );
      await page.keyboard.type("sa");
      await expect(input).toHaveValue("essa");
      await expect(dialog.getByRole("option", { selected: true })).toHaveCount(
        0,
      );
      await page.keyboard.press("ArrowUp");
      await expect(input).toBeFocused();
      await expect(dialog.getByRole("option", { selected: true })).toHaveCount(
        1,
      );
      await page.keyboard.press("Tab");
      await expect(
        dialog.getByRole("button", { name: "Close search" }),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(input).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(page.locator(":focus-visible")).toHaveCount(0);
      await page.keyboard.press(shortcut);
      await expect(input).toHaveValue("");
      await input.fill("Ingest");
      await expect(
        dialog.getByRole("option", { name: "Ingest Page", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/ingest$/);
      await expect(dialog).toBeHidden();
    });
  }

  test("search shortcut toggles without repeat flicker and dismisses on backdrop click", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Explore Geometry", exact: true })
      .click();
    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog", { name: "Search Frequency" });
    await expect(dialog).toBeVisible();
    await page.evaluate(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          repeat: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator(".atlas-inspector")).toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeHidden();
    await page.keyboard.press("Control+Shift+k");
    await expect(dialog).toBeHidden();
    await page.keyboard.press("Meta+k");
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
  });

  test("mobile space and search fit beneath the header", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator(".atlas-canvas")).toBeVisible();
    await expect(page.locator(".atlas-layer-bar")).toBeHidden();
    await expect
      .poll(() =>
        page
          .locator(".atlas-canvas")
          .evaluate((element) =>
            Math.abs(element.getBoundingClientRect().bottom - innerHeight),
          ),
      )
      .toBeLessThanOrEqual(1);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(390);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight))
      .toBe(844);
    await page
      .getByRole("button", { name: "Explore Geometry", exact: true })
      .click();
    await expect(page.locator(".atlas-selection h2")).toBeInViewport();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.abs(
            document
              .querySelector(".atlas-inspector-footer")!
              .getBoundingClientRect().bottom - innerHeight,
          ),
        ),
      )
      .toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".atlas-inspector")).toBeHidden();
    await page
      .getByRole("button", { name: "Search Frequency", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Search Frequency" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator(".site-search :focus-visible")).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus-visible")).toHaveCount(1);
  });
  test("mobile navigation groups remain reachable without covering the header", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const menu = page.locator(".app-menu-mobile");
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("heading", { name: "Research", exact: true }),
    ).toBeVisible();
    await expect(menu.getByRole("link", { name: /^Docket/ })).toBeVisible();
    await expect(menu.getByRole("link", { name: /^Docket/ })).toHaveAttribute(
      "href",
      "/docket",
    );
    await menu.getByRole("link", { name: /^Admin/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(menu).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(390);
  });
});
