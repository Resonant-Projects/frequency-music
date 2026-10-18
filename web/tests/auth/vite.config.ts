import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";

// The real Clerk SDK runs against a fake clerk-js, so no request leaves the
// machine. The key only has to parse: it names an instance that never loads.
process.env.VITE_CLERK_PUBLISHABLE_KEY = `pk_test_${Buffer.from(
  "fixture.clerk.accounts.dev$",
).toString("base64")}`;
process.env.VITE_CLERK_SIGN_IN_URL = "https://accounts.fixture.test/sign-in";
process.env.VITE_CLERK_SIGN_UP_URL = "https://accounts.fixture.test/sign-up";
process.env.VITE_AUTH_BYPASS = "";

export default defineConfig({
  plugins: [
    solid(),
    {
      name: "isolated-auth-fixture",
      enforce: "pre",
      resolveId(source) {
        if (source === "@clerk/clerk-js/no-rhc")
          return fileURLToPath(new URL("./clerk-fixture.ts", import.meta.url));
      },
    },
  ],
  optimizeDeps: {
    entries: ["tests/auth/index.html"],
    exclude: ["@clerk/clerk-js"],
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
    port: 4188,
    strictPort: true,
    fs: { allow: [process.cwd(), realpathSync("node_modules")] },
  },
});
