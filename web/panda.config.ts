import { defineConfig } from "@pandacss/dev";
import { createPreset } from "@park-ui/panda-preset";
import gold from "@park-ui/panda-preset/colors/gold";
import slate from "@park-ui/panda-preset/colors/slate";

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],
  outdir: "styled-system",
  jsxFramework: "solid",
  presets: [
    createPreset({
      accentColor: gold,
      grayColor: slate,
      radius: "lg",
    }),
  ],
  theme: {
    extend: {
      tokens: {
        fonts: {
          display: { value: "'Cormorant Garamond', Georgia, serif" },
          body: { value: "'Cormorant Garamond', Georgia, serif" },
          mono: { value: "'JetBrains Mono', 'IBM Plex Mono', monospace" },
        },
      },
      semanticTokens: {
        colors: {
          zodiac: {
            void: { value: "#0d0620" },
            gold: { value: "#c8a84b" },
            violet: { value: "#8b5cf6" },
            cream: { value: "#f5f0e8" },
            "glow-inner": { value: "#1a0f35" },
          },
        },
      },
    },
  },
});
