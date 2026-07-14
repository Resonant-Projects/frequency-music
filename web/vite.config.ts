import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";

export default defineConfig({
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [solid()],
  appType: "spa",
  // The app imports the root-level convex/_generated/api.js (via ../../../convex),
  // whose `import "convex/server"` would otherwise resolve from the repo-root
  // node_modules — which Vercel never installs (Root Directory = web). Dedupe
  // forces bare `convex` imports to resolve to web's own copy regardless of the
  // importing file's location. See docs/reference/vercel-web-deploy.md.
  resolve: {
    dedupe: ["convex"],
  },
  optimizeDeps: {
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
    port: 4173,
    fs: {
      allow: [".", "../data", "../convex"],
    },
  },
});
