import { expect, test } from "@playwright/test";

test.describe("scroll behavior", () => {
  test("allows wheel scrolling on content routes when page is taller than viewport", async ({
    page,
  }) => {
    await page.goto("/ingest");

    const overflow = await page.evaluate(() => ({
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
    }));

    expect(overflow.bodyOverflowY).not.toBe("hidden");
    expect(overflow.htmlOverflowY).toBe("auto");

    await page.evaluate(() => {
      const root = document.getElementById("root");
      if (!root) throw new Error("Expected #root to exist.");

      window.scrollTo(0, 0);

      const probe = document.createElement("div");
      probe.setAttribute("data-testid", "scroll-probe");
      probe.style.height = "3000px";
      root.appendChild(probe);
    });

    const metrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollY: window.scrollY,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    expect(metrics.scrollY).toBe(0);

    await page.mouse.move(240, 240);
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(150);

    const scrollYAfterWheel = await page.evaluate(() => window.scrollY);
    expect(scrollYAfterWheel).toBeGreaterThan(0);
  });
});
