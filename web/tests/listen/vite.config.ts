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
    host: "127.0.0.1",
    port: 4187,
    strictPort: true,
    fs: { allow: [process.cwd(), realpathSync("node_modules")] },
  },
});
