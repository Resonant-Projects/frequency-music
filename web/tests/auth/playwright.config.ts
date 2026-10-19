import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  use: { baseURL: "http://127.0.0.1:4188" },
  webServer: {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    command: "vp dev --config tests/auth/vite.config.ts",
    url: "http://127.0.0.1:4188/tests/auth/index.html",
    reuseExistingServer: false,
  },
});
