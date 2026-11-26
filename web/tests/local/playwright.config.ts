import { defineConfig } from "@playwright/test";
import { localRole, readRun } from "../../../scripts/local-convex/client.mjs";

const { directory, info } = readRun(process.env.LOCAL_CONVEX_RUN);
export default defineConfig({
  testDir: ".",
  // Writer journeys need the seeded admin; other roles run the refusal probe.
  testMatch: localRole() === "admin" ? "journeys.spec.ts" : "forbidden.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: `${directory}/browser`,
  use: { baseURL: info.frontend, trace: "on", screenshot: "only-on-failure" },
  webServer: {
    cwd: new URL("../../", import.meta.url).pathname,
    command: "vp dev --config tests/local/vite.config.ts",
    url: info.frontend,
    reuseExistingServer: false,
  },
});
