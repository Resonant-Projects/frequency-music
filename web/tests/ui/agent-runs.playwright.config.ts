import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "agent-runs.spec.ts",
  use: { baseURL: "http://127.0.0.1:4186" },
  webServer: {
    cwd: new URL("../../", import.meta.url).pathname,
    command: "vp dev --config tests/ui/vite.config.ts",
    url: "http://127.0.0.1:4186/tests/ui/agent-runs.html",
    reuseExistingServer: false,
  },
});
