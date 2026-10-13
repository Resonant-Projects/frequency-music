import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4186", ...devices["Desktop Chrome"] },
  webServer: {
    command: "vp dev --config tests/ui/vite.config.ts",
    url: "http://127.0.0.1:4186/tests/ui/index.html",
    reuseExistingServer: false,
  },
});
