import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";

export default defineConfig({
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [solid()],
  appType: "spa",
  optimizeDeps: {
    include: ["debug", "extend", "micromark", "remark-parse", "remark-rehype", "unified"],
  },
  server: {
    port: 4173,
    fs: {
      allow: [".", "../data"],
    },
  },
});
