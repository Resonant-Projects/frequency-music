import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  appType: "spa",
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
      allow: [".", "../data"],
    },
  },
});
