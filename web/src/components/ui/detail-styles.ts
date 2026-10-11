import { css } from "../../../styled-system/css";

/** Gold horizontal rule used as a section divider on detail pages. */
export const goldDivider = css({
  border: "none",
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "zodiac.gold/22",
  my: "6",
});

/** "← Back" navigation link — gold mono uppercase with opacity hover. */
export const backLink = css({
  color: "zodiac.gold",
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "mono",
  fontSize: "xs",
  gap: "1.5",
  letterSpacing: "0.14em",
  minH: "6",
  textDecoration: "none",
  textTransform: "uppercase",
  opacity: 0.85,
  _hover: { opacity: 1 },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "zodiac.gold",
    outlineOffset: "2px",
  },
  _coarsePointer: { minH: "11" },
});

/** Detail-page h1 — cream display font, responsive size, normal weight. */
export const detailTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "2xl", md: "3xl" },
  fontWeight: "normal",
  lineHeight: "1.3",
  mt: "3",
});

/** Gold mono uppercase label for section dividers. */
export const sectionLabel = css({
  color: "zodiac.gold",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  mb: "3",
  textTransform: "uppercase",
});

/** Faded mono metadata footer line. */
export const metaLine = css({
  color: "zodiac.cream/66",
  fontFamily: "mono",
  fontSize: "xs",
  overflowWrap: "anywhere",
});

/**
 * The system focus ring (DESIGN.md Buttons → Focus) for anchors and custom
 * buttons that do not go through `UIButton`. Compose with `cx`.
 */
export const focusRingClass = css({
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "zodiac.gold",
    outlineOffset: "2px",
  },
});

/**
 * A standalone text link that is not inline in a sentence: gold mono, at least
 * 24px tall (44px under a coarse pointer) so it meets WCAG 2.5.8 on its own.
 */
export const inlineActionLink = css({
  alignItems: "center",
  color: "zodiac.gold",
  display: "inline-flex",
  fontFamily: "mono",
  fontSize: "xs",
  gap: "1.5",
  letterSpacing: "0.14em",
  minH: "6",
  textDecoration: "none",
  textTransform: "uppercase",
  _hover: { textDecoration: "underline" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "zodiac.gold",
    outlineOffset: "2px",
  },
  _coarsePointer: { minH: "11" },
});
