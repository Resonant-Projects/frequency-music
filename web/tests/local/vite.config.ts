import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite-plus";
import base from "../../vite.config";
import { readRun } from "../../../scripts/local-convex/client.mjs";

const { directory, info } = readRun(process.env.LOCAL_CONVEX_RUN);
const key = readFileSync(resolve(directory, "local-admin-key"), "utf8");
const identity = JSON.parse(
  readFileSync(resolve(directory, "identity.json"), "utf8"),
);
const virtualId = "virtual:local-convex-identity";
export default defineConfig({
  ...base,
  envDir: directory,
  define: {
    "import.meta.env.VITE_AUTH_BYPASS": '"1"',
    "import.meta.env.VITE_E2E_MODE": '"0"',
    "import.meta.env.VITE_CONVEX_URL": JSON.stringify(info.backend),
  },
  plugins: [
    ...(base.plugins ?? []),
    {
      name: "local-convex-verification",
      transformIndexHtml(html) {
        return html.replace("/src/main.tsx", "/tests/local/main.tsx");
      },
      resolveId(id) {
        if (id === virtualId) return "\0" + id;
      },
      load(id) {
        if (id === "\0" + virtualId)
          return `export const endpoint=${JSON.stringify(info.backend)}; export const key=${JSON.stringify(key)}; export const identity=${JSON.stringify(identity)};`;
      },
    },
  ],
  server: {
    ...base.server,
    host: "127.0.0.1",
    port: Number(new URL(info.frontend).port),
    strictPort: true,
    proxy: {},
  },
});
