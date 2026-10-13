import { realpathSync } from "node:fs";
import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";

// Isolated fixture: real Listen/Docket routes, synthetic Convex adapter.
export default defineConfig({
  plugins: [
    solid(),
    {
      name: "isolated-audio-feedback-fixture",
      enforce: "pre",
      resolveId(source) {
        if (source === "../integrations/convex")
          return new URL("./convex-fixture.ts", import.meta.url).pathname;
      },
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          const path = request.url?.split("?")[0];
          if (path === "/listen" || path === "/docket")
            request.url = "/tests/feedback/index.html";
          next();
        });
      },
    },
  ],
  optimizeDeps: {
    entries: ["tests/feedback/index.html"],
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
    port: 5192,
    strictPort: true,
    fs: { allow: [process.cwd(), realpathSync("node_modules")] },
  },
});
