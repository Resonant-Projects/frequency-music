import { expect, type Locator, type Page } from "@playwright/test";

export function createRunId(): string {
  return `e2e-${Date.now()}`;
}

export async function waitForRowByText(
  page: Page,
  text: string,
  timeout = 30_000,
): Promise<Locator> {
  const heading = page.getByRole("heading", { name: text, exact: true }).first();
  await expect(heading).toBeVisible({ timeout });
  const row = heading.locator("xpath=ancestor::div[1]");
  return row;
}

export async function expectNoticeToMatch(
  page: Page,
  patterns: RegExp[],
  timeout = 20_000,
): Promise<void> {
  await expect.poll(
    async () => {
      for (const pattern of patterns) {
        const match = page.getByText(pattern).first();
        if (await match.isVisible().catch(() => false)) {
          return true;
        }
      }
      return false;
    },
    { timeout },
  ).toBeTruthy();
}
