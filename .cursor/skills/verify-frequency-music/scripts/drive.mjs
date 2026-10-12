#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  enterEssays,
  chooseEssaysSearchResult,
  finishRun,
  routeOfflineWebSocket,
} from "./driver-safety.mjs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const skill = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(skill, "../../..");
const require = createRequire(resolve(repo, "web/package.json"));
const { chromium, expect } = require("@playwright/test");
const [feature, receipt] = process.argv.slice(2);
const info = JSON.parse(readFileSync(receipt, "utf8"));
const out = dirname(receipt);
const base = info.url;
assert.equal(info.repo, repo);
assert.equal(info.mode, "offline-local-ui");
const requests = [];
const errors = [];
const external = [];
const backendBlocked = [];
let pendingResult;
let failure;
const actions = [];
let browser;
let context;
let page;
let sequence = 0;

function note(action, result) {
  const row = {
    feature,
    sequence: ++sequence,
    action,
    result,
    url: page.url(),
  };
  actions.push(row);
  appendFileSync(
    resolve(out, `${feature}-actions.jsonl`),
    JSON.stringify(row) + "\n",
  );
}
async function capture(label) {
  const prefix = `${feature}-${String(sequence).padStart(2, "0")}-${label}`;
  writeFileSync(
    resolve(out, `${prefix}.aria.txt`),
    await page.locator("body").ariaSnapshot(),
  );
  await page.screenshot({ path: resolve(out, `${prefix}.png`) });
}
const main = () => page.getByRole("main");
const nav = () => page.getByRole("navigation", { name: "Main navigation" });
const titles = () => main().locator('a[href^="/essays/"]');
async function archive() {
  await expect(
    main().getByRole("heading", { name: "Essays", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Essays — Frequency Music");
  await expect(titles()).toHaveCount(25);
}
async function start() {
  await page.goto(`${base}/essays`);
  await archive();
  note(
    "Navigate to /essays in a fresh browser context",
    "Essays heading, Frequency Music title and 25 essay links",
  );
  await capture("archive");
}
async function openEssay(link, entry) {
  const title = (await link.innerText()).trim();
  const href = await link.getAttribute("href");
  note(`Choose ${entry} title link '${title}'`, { href });
  await capture("before-open");
  await link.click();
  await expect(page).toHaveURL(base + href);
  await expect(
    main().getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(main().getByText("Essay text", { exact: true })).toBeVisible();
  await expect(
    main().getByRole("heading", { name: "Continue Reading", exact: true }),
  ).toBeVisible();
  const article = main()
    .getByText("Essay text", { exact: true })
    .locator("xpath=../..");
  assert.ok(
    (await article.innerText()).length > 500,
    "The essay body must be rendered, not just its card",
  );
  note(`Observe ${entry} detail`, { title, href, renderedBody: true });
  await capture("detail");
  return { title, href };
}
async function back() {
  await main().getByRole("link", { name: "Essays", exact: true }).click();
  await archive();
  note(
    "Choose Essays back link",
    "Archive restored with its first 24 archive cards",
  );
}
async function searchEntry(trigger, target = "Essays") {
  const detail = await titles().first().getAttribute("href");
  await page.goto(base + detail);
  await expect(page).toHaveURL(base + detail);
  await expect(main().getByText("Essay text", { exact: true })).toBeVisible();
  if (trigger === "button") {
    await page
      .getByRole("button", { name: "Search Frequency", exact: true })
      .click();
  } else {
    await page.keyboard.press(trigger);
  }
  const dialog = page.getByRole("dialog", { name: "Search Frequency" });
  const input = dialog.getByRole("combobox", { name: "Search Frequency" });
  await expect(input).toBeFocused();
  await input.fill(target);
  const option = dialog.getByRole("option", {
    name: `${target} Page`,
    exact: true,
  });
  await expect(option).toBeVisible();
  note(
    `Open search with ${trigger}; type '${target}'`,
    "Local Pages result is visible; backend search is not being asserted",
  );
  await capture("search-result");
  await chooseEssaysSearchResult(option, page, dialog, base, expect);
  await archive();
  note(
    `Choose ${target} Page`,
    "Essays archive is visible and search is closed",
  );
}
async function essays() {
  await start();
  const first = await openEssay(titles().first(), "Latest dispatch");
  note("Reload essay detail URL", first.href);
  await page.reload();
  await expect(
    main().getByRole("heading", { name: first.title, exact: true }),
  ).toBeVisible();
  await expect(main().getByText("Essay text", { exact: true })).toBeVisible();
  await capture("reloaded-detail");
  const related = await openEssay(titles().first(), "Continue Reading");
  assert.notEqual(related.href, first.href);
  await back();
  await openEssay(titles().nth(1), "Archive card");
  await back();
  await page.getByRole("button", { name: "Show more", exact: true }).click();
  await expect(titles()).toHaveCount(49);
  await expect(titles().nth(25)).toBeFocused();
  note(
    "Choose Show more",
    "49 links visible; focus moved to the first newly revealed archive card",
  );
  await capture("expanded-archive");
  await openEssay(titles().nth(25), "Newly revealed card");
  await back();
  await page.goto(base + first.href);
  await enterEssays(page, nav(), base, expect);
  await archive();
  note(
    "Choose Library then Essays in desktop navigation",
    "Essays archive is visible",
  );
  await capture("desktop-entry");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + first.href);
  await enterEssays(page, nav(), base, expect, true);
  await archive();
  note(
    "Choose Menu then Library / Essays on mobile",
    "Essays archive is visible",
  );
  await capture("mobile-entry");
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const trigger of ["button", "Meta+k", "Control+k"])
    await searchEntry(trigger);
  const title = first.title;
  await page
    .getByRole("button", { name: "Search Frequency", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Search Frequency" }).fill(title);
  const result = page
    .getByRole("group", { name: "Essays", exact: true })
    .getByRole("option", { name: `${title} Essay`, exact: true });
  await expect(result).toBeVisible();
  note(`Search the title '${title}'`, "Local Essay result is visible");
  await capture("essay-search-result");
  await result.click();
  await expect(
    main().getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  note("Choose essay search result", "Matching essay detail opens");
  await capture("search-detail");
  await page.goto(`${base}/essays/verification-nonexistent-essay`);
  await expect(
    main().getByText("Essay not found.", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Essay not found — Frequency Music");
  note(
    "Navigate to an unknown essay slug",
    "Essay not found. appears instead of stale content",
  );
  await capture("not-found");
}
async function navigation() {
  await start();
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
    ["Compose", ["Recipes", "Compositions", "Feedback", "Listen"]],
    ["Library", ["Essays", "Weekly Turns", "Editorial", "Failures"]],
    ["Operations", ["Agent Runs", "Review Queue", "Admin"]],
  ]) {
    await nav().getByRole("button", { name: group, exact: true }).click();
    for (const name of names)
      await expect(
        nav().getByRole("link", { name: new RegExp(`^${name}`) }),
      ).toBeVisible();
    note(`Open ${group}`, { visibleLinks: names });
    await capture(`group-${group.toLowerCase()}`);
    await page.keyboard.press("Escape");
    await expect(nav().locator(".app-menu-panel:visible")).toHaveCount(0);
  }
  await nav().getByRole("button", { name: "Library", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expect(
    nav().locator(".app-menu-panel:visible a").first(),
  ).toBeFocused();
  note(
    "Enter opens Library and ArrowDown moves focus",
    "First Library link is focused",
  );
  await page.keyboard.press("Escape");
  const detail = await titles().first().getAttribute("href");
  await page.goto(base + detail);
  await enterEssays(page, nav(), base, expect);
  await archive();
  note(
    "Choose desktop Library / Essays from a detail route",
    "Archive URL restored; menu collapsed",
  );
  await capture("desktop-navigation");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + detail);
  await enterEssays(page, nav(), base, expect, true);
  await archive();
  note(
    "Open mobile Menu and choose Essays",
    "Archive visible; mobile menu closed",
  );
  await capture("mobile-navigation");
}
async function search() {
  await start();
  for (const trigger of ["button", "Meta+k", "Control+k"])
    await searchEntry(trigger);
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search Frequency" });
  const input = dialog.getByRole("combobox", { name: "Search Frequency" });
  await input.fill("es");
  await expect(
    dialog.getByRole("option", { name: "Essays Page", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("option", { selected: true })).toHaveCount(1);
  await input.fill("essa");
  await expect(dialog.getByRole("option", { selected: true })).toHaveCount(0);
  note(
    "ArrowDown selects a result; changing query clears selection",
    "Exactly one selected option becomes zero",
  );
  await capture("search-selection");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.keyboard.press("Control+k");
  await expect(input).toHaveValue("");
  await dialog.getByRole("button", { name: "Close search" }).click();
  await expect(dialog).toBeHidden();
  note(
    "Escape and Close search dismiss; reopen resets query",
    "Dialog hidden and reopened query empty",
  );
}

try {
  writeFileSync(
    resolve(out, `${feature}-result.json`),
    JSON.stringify({ status: "running", feature }) + "\n",
  );
  if (feature === "ingest")
    throw new Error(
      "BLOCKED: Ingest requires an explicitly approved isolated Convex deployment and write identity. This helper will not mutate the shared live backend.",
    );
  assert.ok(["doctor", "essays", "navigation", "search"].includes(feature));
  writeFileSync(resolve(out, `${feature}-actions.jsonl`), "");
  browser = await chromium.launch();
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (
      new URL(url).origin !== base ||
      !["GET", "HEAD"].includes(route.request().method())
    ) {
      external.push(url);
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  await context.routeWebSocket(/.*/, (ws) => {
    routeOfflineWebSocket(ws, info, external, backendBlocked);
  });
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("request", (request) =>
    requests.push({ method: request.method(), url: request.url() }),
  );
  const consoleMessages = [];
  page.on("console", (message) =>
    consoleMessages.push({ type: message.type(), text: message.text() }),
  );
  if (feature === "doctor") await start();
  else await { essays, navigation, search }[feature]();
  assert.deepEqual(errors, [], "Unexpected unhandled JavaScript errors");
  assert.deepEqual(
    external,
    [],
    "App attempted traffic outside this local instance",
  );
  assert.ok(
    requests.every((request) => ["GET", "HEAD"].includes(request.method)),
    "Read-only journey unexpectedly issued an HTTP write",
  );
  writeFileSync(
    resolve(out, `${feature}-console.json`),
    JSON.stringify(consoleMessages, null, 2),
  );
  pendingResult = {
    status: "pass",
    feature,
    mode: info.mode,
    actions: actions.length,
    pageErrors: errors,
    externalRequests: external,
    backendWebSocketsBlocked: backendBlocked,
    requests,
    scope:
      "Real local frontend with existing client auth bypass. No Clerk, Convex data, backend mutations or complete research-search proof.",
  };
} catch (error) {
  failure = error;
  if (page) {
    note("Failure", String(error));
    await capture("failure").catch(() => {});
  }
} finally {
  const { completed, failure: finalFailure } = await finishRun({
    context,
    browser,
    out,
    feature,
    result: pendingResult || { errors, external },
    error: failure,
    writeResult: (result) =>
      writeFileSync(
        resolve(out, `${feature}-result.json`),
        JSON.stringify(result, null, 2) + "\n",
      ),
  });
  if (finalFailure) {
    console.error(finalFailure);
    process.exitCode = 1;
  } else
    console.log(JSON.stringify({ ...completed, requests: requests.length }));
}
