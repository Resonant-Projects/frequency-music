import { defineConfig } from "@playwright/test";

// Homelab Playwright browser pool (keithce/homelab-infra ADR 0015), set only by
// .github/workflows/browser-pool-pilot.yml on frequency-arc. The pool's browser
// maps localhost to the runner pod, so the page uses localhost there; an IP
// literal such as 127.0.0.1 would bypass that mapping. Not
// PW_TEST_CONNECT_WS_ENDPOINT: Playwright then drops the connect timeout.
const poolEndpoint = process.env.PLAYWRIGHT_BROWSER_POOL_WS_ENDPOINT;
const host = poolEndpoint ? "localhost" : "127.0.0.1";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  use: {
    baseURL: `http://${host}:4187`,
    ...(poolEndpoint
      ? { connectOptions: { wsEndpoint: poolEndpoint, timeout: 180_000 } }
      : {}),
  },
  webServer: {
    cwd: new URL("../../", import.meta.url).pathname,
    command: "vp dev --config tests/listen/vite.config.ts",
    // Readiness is checked from the runner itself, not the pool's browser.
    url: "http://127.0.0.1:4187/tests/listen/index.html",
    reuseExistingServer: false,
  },
});
