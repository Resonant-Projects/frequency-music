import { css } from "../../../styled-system/css";

/** Gold horizontal rule used as a section divider on detail pages. */
export const goldDivider = css({
  border: "none",
  borderTop: "1px solid rgba(200, 168, 75, 0.22)",
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
  textDecoration: "none",
  textTransform: "uppercase",
  opacity: 0.7,
  _hover: { opacity: 1 },
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
  color: "rgba(245, 240, 232, 0.55)",
  fontFamily: "mono",
  fontSize: "xs",
});
