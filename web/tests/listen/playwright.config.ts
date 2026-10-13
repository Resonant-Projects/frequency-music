import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  use: { baseURL: "http://127.0.0.1:4187" },
  webServer: {
    cwd: new URL("../../", import.meta.url).pathname,
    command: "vp dev --config tests/listen/vite.config.ts",
    url: "http://127.0.0.1:4187/tests/listen/index.html",
    reuseExistingServer: false,
  },
});
