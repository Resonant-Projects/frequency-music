import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  test: {
    include: ["convex/*.test.ts", "harness/**/*.test.ts"],
    environment: "node",
  },
  lint: {
    categories: {
      correctness: "error",
      suspicious: "warn",
      perf: "warn",
    },
    plugins: ["typescript", "unicorn", "import", "promise"],
    ignorePatterns: [
      "convex/_generated/**",
      "node_modules/**",
      "web/styled-system/**",
      "dist/**",
      // Frozen one-shot reference scripts — byte-identical by policy, never run.
      "scripts/archive/**",
    ],
    rules: {
      "typescript/no-namespace": "error",
      "typescript/no-require-imports": "error",
      "import/no-unassigned-import": "warn",
      "require-await": "warn",
      "no-else-return": "warn",
      "no-await-in-loop": "off",
      "unicorn/prefer-string-replace-all": "warn",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        files: ["src/styles/**", "src/polyfills.js"],
        rules: {
          "import/no-unassigned-import": "off",
        },
      },
      {
        files: ["web/src/main.tsx"],
        rules: {
          "import/no-unassigned-import": "off",
        },
      },
      {
        files: ["convex/*.test.ts", "web/tests/**"],
        rules: {
          "require-await": "off",
        },
      },
      {
        files: ["web/src/integrations/**"],
        rules: {
          "require-await": "off",
        },
      },
      {
        files: ["convex/*.ts"],
        rules: {
          "no-shadow": "off",
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
});
