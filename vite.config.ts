import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  test: {
    include: [
      "convex/*.test.ts",
      "convex/shared/*.test.ts",
      "harness/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    // Frozen one-shot reference scripts — never run their suites.
    exclude: ["**/node_modules/**", "scripts/archive/**"],
    environment: "node",
    // CI runners share an incus host; under load the suite runs 2-3x slower
    // and ~1 s tests passed vitest's 5 s default.
    testTimeout: 30_000,
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
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
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
        files: ["convex/agentToolRegistry.test.ts"],
        rules: {
          // Manifest coverage intentionally checks every dynamically named export.
          "import/namespace": ["error", { allowComputed: true }],
        },
      },
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
