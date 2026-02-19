// @ts-check
import convexPlugin from "@convex-dev/eslint-plugin";
import tseslint from "typescript-eslint";
import biome from "eslint-config-biome";

export default tseslint.config(
  // Globally ignored paths
  {
    ignores: ["convex/_generated/**", "node_modules/**"],
  },

  // Convex rules (includes Convex-specific @typescript-eslint-based rules)
  ...convexPlugin.configs.recommended,

  // Type-aware TypeScript rules scoped to .ts/.tsx files only
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Convex internal APIs return `any` — disable unsafe rules that fire on them
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },

  // Disable all ESLint rules that Biome covers — must be last
  biome,
);
