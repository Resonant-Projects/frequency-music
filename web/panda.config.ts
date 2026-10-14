import { defineConfig } from "@pandacss/dev";
import { createPreset } from "@park-ui/panda-preset";
import gold from "@park-ui/panda-preset/colors/gold";
import slate from "@park-ui/panda-preset/colors/slate";

export default defineConfig({
  preflight: true,
  // Style values must be tokens or valid CSS keywords. A one-off value that
  // DESIGN.md does not name goes through the `[...]` escape hatch so it
  // stays greppable.
  strictTokens: true,
  strictPropertyValues: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],
  outdir: "styled-system",
  jsxFramework: "solid",
  presets: [
    "@pandacss/preset-base",
    createPreset({
      accentColor: gold,
      grayColor: slate,
      radius: "lg",
    }),
  ],
  conditions: {
    extend: {
      coarsePointer: "@media (pointer: coarse)",
      hover: {
        "@media (hover: hover) and (pointer: fine)": {
          "&:is(:hover, [data-hover])": "@slot",
        },
      },
    },
  },
  theme: {
    extend: {
      tokens: {
        // The three sanctioned shadows (DESIGN.md Elevation → Shadow Vocabulary).
        // All are state-only: hover lift, sticky detachment, hover glow.
        shadows: {
          cardHover: { value: "0 22px 48px rgba(0, 0, 0, 0.24)" },
          detachedBar: { value: "0 -12px 40px rgba(13, 6, 32, 0.6)" },
          goldGlow: { value: "0 0 12px rgba(200, 168, 75, 0.08)" },
        },
        fonts: {
          display: { value: "'Cormorant Garamond', Georgia, serif" },
          body: { value: "'Cormorant Garamond', Georgia, serif" },
          mono: { value: "'JetBrains Mono', monospace" },
        },
        // DESIGN.md Typography → Hierarchy. Snap new type to these steps
        // rather than adding near-duplicates.
        fontSizes: {
          // The Ten Pixel Floor: eyebrows and stat labels only.
          micro: { value: "10px" },
        },
        lineHeights: {
          // Essay cards and the essay hero, set tight like a poster.
          poster: { value: "1.08" },
          display: { value: "1.3" },
          label: { value: "1.4" },
          // Body copy below 1rem: dense panels, cards, code and data blocks.
          dense: { value: "1.65" },
          // Body copy at 1rem and above.
          prose: { value: "1.75" },
        },
        letterSpacings: {
          // Slightly negative tracking on large serif titles.
          display: { value: "-0.01em" },
          // The Tracked Caps Rule floor: headlines, labels, metadata.
          label: { value: "0.14em" },
          // Button faces.
          labelWide: { value: "0.18em" },
          // Badges and other wide mono caps.
          labelWider: { value: "0.2em" },
          micro: { value: "0.3em" },
        },
        sizes: {
          // Text-only reading measure.
          measure: { value: "72ch" },
          // Essay and correspondence bodies.
          reading: { value: "48rem" },
          container: { value: "1200px" },
        },
        spacing: {
          // Field focus outlines sit 1px off the lit border.
          px: { value: "1px" },
        },
        borders: {
          hairline: { value: "1px solid" },
          // DESIGN.md Buttons → Focus: every control's 2px outline.
          focus: { value: "2px solid" },
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
