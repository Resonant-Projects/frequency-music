// Refusal probe for a signed-in identity without a writer role. It records what
// each write control shows; it asserts only that nothing persisted and that
// the backend refused with FORBIDDEN. How the UI should surface that is open.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { makeFunctionReference } from "convex/server";
import {
  localClient,
  localRole,
  readRun,
} from "../../../scripts/local-convex/client.mjs";

const run = process.env.LOCAL_CONVEX_RUN!;
const role = localRole();
const { directory, info } = readRun(run);
const identity = JSON.parse(
  readFileSync(resolve(directory, "identity.json"), "utf8"),
);
const reader = localClient(run, identity);
const census = () =>
  reader.query(makeFunctionReference("localVerification:census"), {});

type Probe = {
  name: string;
  path: string;
  act: (page: Page) => Promise<void>;
};
const probes: Probe[] = [
  {
    name: "ingest-url",
    path: "/ingest",
    act: async (page) => {
      await page
        .locator("#url-input-url")
        .fill(`https://example.invalid/${run}`);
      await page.locator("#url-input-title").fill(`Refused source ${run}`);
      await page
        .getByRole("button", { name: "Ingest URL", exact: true })
        .click();
    },
  },
  {
    name: "add-feed",
    path: "/ingest",
    act: async (page) => {
      await page.locator("#ingest-feed-name").fill(`Refused feed ${run}`);
      await page
        .locator("#ingest-feed-url")
        .fill(`https://example.invalid/${run}/feed.xml`);
      await page.locator("#ingest-feed-type").selectOption("rss");
      await page.getByRole("button", { name: "Add Feed", exact: true }).click();
    },
  },
  {
    name: "poll-feeds",
    path: "/ingest",
    act: async (page) => {
      await page.getByTestId("ingest-poll-feeds-btn").click();
    },
  },
  {
    name: "create-hypothesis",
    path: "/hypotheses",
    act: async (page) => {
      await page.locator("#hyp-title").fill(`Refused hypothesis ${run}`);
      await page.locator("#hyp-question").fill("Is this write refused?");
      await page
        .locator("#hyp-statement")
        .fill("A follower or unregistered identity cannot create this.");
      await page.locator("#hyp-why").fill("Local refusal probe.");
      await page
        .getByRole("button", { name: "Create Hypothesis", exact: true })
        .click();
    },
  },
  {
    name: "admin-batch-extraction",
    path: "/admin",
    act: async (page) => {
      await page
        .getByRole("button", { name: "Queue Batch Extraction", exact: true })
        .click();
    },
  },
];

const observations: Record<string, unknown>[] = [];
test.describe.configure({ mode: "serial" });
test.afterAll(() => {
  writeFileSync(
    resolve(directory, `forbidden-${role}.json`),
    JSON.stringify({ role, subject: identity.subject, observations }, null, 2),
  );
});

for (const probe of probes) {
  test(`${probe.name} as ${role}`, async ({ page }) => {
    const external: string[] = [];
    const pageErrors: string[] = [];
    const consoleLines: string[] = [];
    const forbiddenFrames: string[] = [];
    const allowed = [info.frontend, info.backend, info.site];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning")
        consoleLines.push(`${message.type()}: ${message.text()}`);
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (allowed.includes(url.origin)) return route.continue();
      external.push(url.origin + url.pathname);
      return route.abort();
    });
    await page.routeWebSocket("**/*", (ws) => {
      const origin = new URL(ws.url()).origin.replace(/^ws/, "http");
      if (!allowed.includes(origin)) {
        external.push(origin);
        return ws.close();
      }
      const server = ws.connectToServer();
      ws.onMessage((message) => server.send(message));
      server.onMessage((message) => {
        const text = typeof message === "string" ? message : "";
        if (text.includes("FORBIDDEN"))
          forbiddenFrames.push(text.slice(0, 400));
        ws.send(message);
      });
    });

    await page.goto(probe.path);
    await page.waitForLoadState("networkidle");
    const before = await census();
    await probe.act(page);
    // Give the mutation/action round trip time to settle and render.
    await page.waitForTimeout(3000);
    // Only rendered (non-hidden) feedback counts as something the user saw.
    const visible = async (selector: string) =>
      (await page.locator(selector).filter({ visible: true }).allInnerTexts())
        .map((text) => text.trim())
        .filter(Boolean);
    // Whether a rendered alert intersects the viewport where the user clicked.
    const shownAlerts = page
      .locator('[role="alert"]')
      .filter({ visible: true });
    const alertInViewport =
      (await shownAlerts.count()) > 0
        ? (
            await shownAlerts.evaluateAll((elements) =>
              elements.map((element) => {
                const box = element.getBoundingClientRect();
                return (
                  box.width > 0 &&
                  box.height > 0 &&
                  box.bottom > 0 &&
                  box.right > 0 &&
                  box.top < window.innerHeight &&
                  box.left < window.innerWidth
                );
              }),
            )
          ).some(Boolean)
        : null;
    const observation = {
      probe: probe.name,
      path: probe.path,
      alertInViewport,
      alerts: await visible('[role="alert"]'),
      statuses: await visible('[role="status"]'),
      forbiddenFromBackend: forbiddenFrames.length > 0,
      forbiddenFrame: forbiddenFrames[0] ?? null,
      console: consoleLines.map((line) => line.slice(0, 400)),
      pageErrors: pageErrors.map((line) => line.slice(0, 400)),
    };
    observations.push(observation);
    // The viewport shot is what the user saw right after clicking.
    await page.screenshot({
      path: resolve(directory, `forbidden-${role}-${probe.name}.png`),
    });
    expect(await census(), "a refused write must persist nothing").toEqual(
      before,
    );
    expect(external, "only owned localhost services").toEqual([]);
    expect(
      observation.forbiddenFromBackend,
      "backend must refuse with FORBIDDEN",
    ).toBe(true);
  });
}
