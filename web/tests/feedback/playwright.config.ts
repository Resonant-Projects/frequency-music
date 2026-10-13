import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  use: { baseURL: "http://127.0.0.1:5192" },
  webServer: {
    cwd: new URL("../../", import.meta.url).pathname,
    command: "vp dev --config tests/feedback/vite.config.ts",
    url: "http://127.0.0.1:5192/tests/feedback/index.html",
    reuseExistingServer: false,
  },
});
