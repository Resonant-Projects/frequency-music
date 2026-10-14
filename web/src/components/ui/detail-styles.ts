import { css } from "../../../styled-system/css";

/**
 * The system focus ring (DESIGN.md Buttons → Focus). Spread into a `css()`
 * object; `focusRingClass` is the same thing as a composable class.
 */
export const focusRingStyle = {
  _focusVisible: {
    outline: "focus",
    outlineColor: "zodiac.gold",
    outlineOffset: "0.5",
  },
} as const;

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
  letterSpacing: "label",
  minH: "6",
  textDecoration: "none",
  textTransform: "uppercase",
  opacity: 0.85,
  _hover: { opacity: 1 },
  ...focusRingStyle,
  _coarsePointer: { minH: "11" },
});

/** Detail-page h1 — cream display font, responsive size, normal weight. */
export const detailTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "2xl", md: "3xl" },
  fontWeight: "normal",
  lineHeight: "display",
  mt: "3",
});

/** Gold mono uppercase label for section dividers. */
export const sectionLabel = css({
  color: "zodiac.gold",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "label",
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

/** `focusRingStyle` as a class for anchors and custom buttons; compose with `cx`. */
export const focusRingClass = css(focusRingStyle);

/** `metaLine` in uppercase: the mono label beside a value or above a row. */
export const metaLabelClass = css({
  color: "zodiac.cream/66",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "label",
  overflowWrap: "anywhere",
  textTransform: "uppercase",
});

/** A record title that links somewhere: cream, underlined on hover, ringed on focus. */
export const recordLinkClass = css({
  alignItems: "center",
  color: "zodiac.cream",
  display: "inline-flex",
  minH: "6",
  textDecoration: "none",
  _hover: { textDecoration: "underline" },
  ...focusRingStyle,
  _coarsePointer: { minH: "11" },
});

/**
 * A focusable, scrollable block of pretty-printed JSON or raw text. Use with
 * `role="group"`, `tabIndex={0}`, an `aria-label` and the `zodiac-scroll` class.
 */
export const jsonBlockClass = css({
  bg: "zodiac.void/60",
  borderColor: "zodiac.cream/12",
  borderRadius: "l2",
  borderWidth: "1px",
  color: "zodiac.cream/72",
  fontFamily: "mono",
  fontSize: "xs",
  maxH: "72",
  overflow: "auto",
  overflowWrap: "anywhere",
  p: "3",
  whiteSpace: "pre-wrap",
  ...focusRingStyle,
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
  letterSpacing: "label",
  minH: "6",
  textDecoration: "none",
  textTransform: "uppercase",
  _hover: { textDecoration: "underline" },
  ...focusRingStyle,
  _coarsePointer: { minH: "11" },
});
