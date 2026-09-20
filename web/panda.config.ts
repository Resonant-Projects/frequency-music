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
  conditions: {
    extend: {
      coarsePointer: "@media (pointer: coarse)",
    },
  },
  theme: {
    extend: {
      tokens: {
        fonts: {
          display: { value: "'Cormorant Garamond', Georgia, serif" },
          body: { value: "'Cormorant Garamond', Georgia, serif" },
          mono: { value: "'JetBrains Mono', monospace" },
        },
      },
      semanticTokens: {
        colors: {
          zodiac: {
            void: { value: "#0d0620" },
            gold: { value: "#c8a84b" },
            violet: { value: "#8b5cf6" },
            // Text-safe violet: #8b5cf6 only reaches 4.66:1 on the void at full
            // alpha, so anything smaller than a heading uses this lighter step
            // (~6.5:1) while reading as the same hue.
            violetText: { value: "#a78bfa" },
            cream: { value: "#f5f0e8" },
            error: { value: "#f87171" },
            "glow-inner": { value: "#1a0f35" },
            // Deepened-warm gold used for the solid primary button's hover
            // state; Park UI's accent steps are not emitted by this config, so
            // the hover step has to be a semantic token of its own.
            goldBright: { value: "#dcc06a" },
            // Semantic status roles. Success and warning are the only hues
            // outside the indigo/gold/violet/error family, and they are
            // reserved for pass/fail and needs-review signalling.
            success: { value: "#51c475" },
            warning: { value: "#e8b04a" },
            // Informational state reuses the text-safe violet step so that
            // "provisional" reads the same everywhere.
            info: { value: "#a78bfa" },
          },
        },
      },
    },
  },
});
