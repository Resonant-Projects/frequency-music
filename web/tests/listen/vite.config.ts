import { realpathSync } from "node:fs";
import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";
export default defineConfig({
  plugins: [
    solid(),
    {
      name: "isolated-listen-fixture",
      enforce: "pre",
      resolveId(source) {
        if (source === "../integrations/convex")
          return new URL("./convex-fixture.ts", import.meta.url).pathname;
      },
    },
  ],
  optimizeDeps: {
    entries: ["tests/listen/index.html"],
    include: [
      "debug",
      "extend",
      "micromark",
      "remark-parse",
      "remark-rehype",
      "unified",
    ],
  },
  server: {
    // The browser pool pilot serves the fixture beyond loopback so the pool's
    // browser can reach this runner pod; everywhere else it stays on loopback.
    host: process.env.PLAYWRIGHT_BROWSER_POOL_WS_ENDPOINT
      ? "0.0.0.0"
      : "127.0.0.1",
    port: 4187,
    strictPort: true,
    fs: { allow: [process.cwd(), realpathSync("node_modules")] },
  },
});
