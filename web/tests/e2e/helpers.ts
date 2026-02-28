import { expect, type Locator, type Page } from "@playwright/test";

export function createRunId(): string {
  return `e2e-${Date.now()}`;
}

export async function waitForRowByText(
  page: Page,
  text: string,
  timeout = 30_000,
): Promise<Locator> {
  const row = page
    .getByTestId("entity-row")
    .filter({ has: page.getByRole("heading", { name: text, exact: true }) })
    .first();
  await expect(row).toBeVisible({ timeout });
  return row;
}

export async function expectNoticeToMatch(
  page: Page,
  patterns: RegExp[],
  timeout = 20_000,
): Promise<void> {
  await expect
    .poll(
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
    )
    .toBeTruthy();
}
