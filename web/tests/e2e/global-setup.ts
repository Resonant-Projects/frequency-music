import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  chromium,
  type FullConfig,
  type Locator,
  type Page,
} from "@playwright/test";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readEnvVarFromFile(filePath: string, key: string): string | undefined {
  try {
    const contents = readFileSync(filePath, "utf8");
    const match = contents.match(new RegExp(`^${key}=(.*)$`, "m"));
    if (!match?.[1]) return undefined;
    return match[1].trim().replaceAll(/^['"]|['"]$/g, "");
  } catch {
    return undefined;
  }
}

function getEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const repoRoot = resolve(currentDir, "../../..");
  const webRoot = resolve(repoRoot, "web");
  return (
    readEnvVarFromFile(resolve(webRoot, ".env.local"), key) ??
    readEnvVarFromFile(resolve(repoRoot, ".env.local"), key)
  );
}

async function findVisibleLocator(
  page: Page,
  locators: Locator[],
): Promise<Locator> {
  for (const locator of locators) {
    if (
      await locator
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return locator.first();
    }
  }
  throw new Error("Expected a visible Clerk login control, but none matched.");
}

async function fillIdentifier(page: Page, value: string) {
  const locator = await findVisibleLocator(page, [
    page.getByLabel(/email/i),
    page.getByPlaceholder(/email/i),
    page.locator('input[type="email"]'),
    page.locator('input[name*="identifier"]'),
    page.locator('input[name*="email"]'),
  ]);
  await locator.fill(value);
}

async function fillPassword(page: Page, value: string) {
  const locator = await findVisibleLocator(page, [
    page.getByLabel(/password/i),
    page.getByPlaceholder(/password/i),
    page.locator('input[type="password"]'),
    page.locator('input[name*="password"]'),
  ]);
  await locator.fill(value);
}

async function clickPrimaryAction(page: Page, names: RegExp[]) {
  const buttons = names.map((name) => page.getByRole("button", { name }));
  const locator = await findVisibleLocator(page, buttons);
  await locator.click();
}

export default async function globalSetup(config: FullConfig) {
  const email = getEnv("E2E_CLERK_EMAIL");
  const password = getEnv("E2E_CLERK_PASSWORD");
  const signInUrl = getEnv("VITE_CLERK_SIGN_IN_URL");
  const baseURL = config.projects[0]?.use?.baseURL;

  if (!email || !password || !signInUrl || typeof baseURL !== "string") {
    throw new Error(
      "Missing e2e auth setup. Required: E2E_CLERK_EMAIL, E2E_CLERK_PASSWORD, VITE_CLERK_SIGN_IN_URL, and Playwright baseURL.",
    );
  }

  const storageStatePath = resolve(currentDir, ".auth/user.json");
  mkdirSync(dirname(storageStatePath), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const loginUrl = new URL(signInUrl);
  loginUrl.searchParams.set("redirect_url", `${baseURL}/weekly-turns`);
  await page.goto(loginUrl.toString(), { waitUntil: "domcontentloaded" });

  await fillIdentifier(page, email);

  if (
    !(await page
      .locator('input[type="password"]')
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    await clickPrimaryAction(page, [/continue/i, /next/i, /sign in/i]);
  }

  await fillPassword(page, password);
  await clickPrimaryAction(page, [/sign in/i, /continue/i]);

  await page.waitForURL((url) => url.toString().startsWith(baseURL), {
    timeout: 60_000,
  });
  await context.storageState({ path: storageStatePath });
  await browser.close();
}
