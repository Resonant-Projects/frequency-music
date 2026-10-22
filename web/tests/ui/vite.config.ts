import { realpathSync } from "node:fs";
import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";

// Standalone fixtures never import the app bootstrap, Clerk, or Convex client.
export default defineConfig({
  plugins: [
    solid(),
    {
      name: "isolated-review-fixtures",
      enforce: "pre",
      resolveId(source) {
        if (source === "../integrations/convex")
          return new URL("./convex-fixture.ts", import.meta.url).pathname;
      },
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url?.split("?")[0] === "/agent-drafts")
            request.url = "/tests/ui/drafts.html";
          if (request.url?.split("?")[0] === "/agent-runs")
            request.url = "/tests/ui/agent-runs.html";
          next();
        });
      },
    },
  ],
  optimizeDeps: {
    entries: [
      "tests/ui/index.html",
      "tests/ui/drafts.html",
      "tests/ui/agent-runs.html",
    ],
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
    host: "127.0.0.1",
    port: 4186,
    strictPort: true,
    fs: { allow: [process.cwd(), realpathSync("node_modules")] },
  },
});
