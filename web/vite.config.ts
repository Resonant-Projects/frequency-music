import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite-plus";
import solid from "vite-plugin-solid";
import {
  compareEssays,
  parseEssay,
  toEssaySummary,
} from "./src/lib/essay-parse.ts";

const essaysDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../docs/essays",
);

const ESSAY_INDEX_ID = "virtual:essay-index";
const RESOLVED_ESSAY_INDEX_ID = "\0virtual:essay-index";

/**
 * Serves `virtual:essay-index`: the archive listing (slug, title, excerpt,
 * date, read time, word count) parsed from `docs/essays/*.md` at build time.
 * Bodies stay out of it — `web/src/lib/essays.ts` loads those on demand — so
 * the 6.7 MB corpus never lands in the entry chunk.
 */
function essayIndexPlugin() {
  return {
    name: "frequency-essay-index",
    resolveId(id: string) {
      return id === ESSAY_INDEX_ID ? RESOLVED_ESSAY_INDEX_ID : undefined;
    },
    load(id: string) {
      if (id !== RESOLVED_ESSAY_INDEX_ID) return undefined;
      const summaries = readdirSync(essaysDir)
        .filter((name) => name.endsWith(".md"))
        .map((name) =>
          toEssaySummary(
            parseEssay(
              name.slice(0, -".md".length),
              readFileSync(join(essaysDir, name), "utf8"),
            ),
          ),
        )
        .sort(compareEssays);
      return `export default ${JSON.stringify(summaries)};`;
    },
    // docs/essays lives outside the web root, so the dev server does not watch
    // it by default; add it and invalidate the index when an essay changes.
    configureServer(server) {
      server.watcher.add(essaysDir);
    },
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(essaysDir)) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ESSAY_INDEX_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
    },
  } satisfies Plugin;
}

export default defineConfig({
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [solid(), essayIndexPlugin()],
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
