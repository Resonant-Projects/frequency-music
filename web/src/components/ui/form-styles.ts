import { css } from "../../../styled-system/css";

export const pageClass = css({
  display: "grid",
  gap: "6",
  // `minmax(0, 1fr)` rather than the implicit `auto` column: an unbreakable
  // URL or error token would otherwise widen the page past a phone viewport.
  gridTemplateColumns: "minmax(0, 1fr)",
  maxW: "container",
  marginInline: "auto",
  p: { base: "4", md: "6" },
  width: "full",
});

export const pageTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "2xl", md: "3xl" },
  fontWeight: "normal",
  lineHeight: "display",
  marginBottom: "3",
});

export const sectionTitleClass = css({
  color: "zodiac.gold",
  fontFamily: "mono",
  fontSize: "sm",
  letterSpacing: "label",
  marginBottom: "3",
  textTransform: "uppercase",
});

export const fieldLabelClass = css({
  color: "zodiac.cream/75",
  display: "block",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "label",
  marginBottom: "1.5",
  marginTop: "4",
  textTransform: "uppercase",
});

/** Serif body copy at the documented prose measure (DESIGN.md Typography). */
export const proseClass = css({
  color: "zodiac.cream/82",
  fontFamily: "display",
  fontSize: "md",
  lineHeight: "prose",
  maxW: "measure",
});

/** Secondary copy under a title or control: the 0.66 cream floor, 14px. */
export const helperClass = css({
  color: "zodiac.cream/66",
  fontFamily: "display",
  fontSize: "sm",
  lineHeight: "dense",
  maxW: "measure",
});

/** 10px wide-tracked mono eyebrow — the only sanctioned use of 10px text. */
export const eyebrowClass = css({
  color: "zodiac.gold/78",
  fontFamily: "mono",
  fontSize: "micro",
  letterSpacing: "micro",
  textTransform: "uppercase",
});

/** A `<ul>`/`<ol>` with no bullets or default spacing (see `UIList`). */
export const plainListClass = css({
  listStyle: "none",
  m: "0",
  p: "0",
});

/** A wrapping row of badges or small controls. */
export const badgeRowClass = css({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "2",
});

/** A form's trailing action row. */
export const formActionsClass = css({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "3",
  justifyContent: "flex-end",
});

/** Visually hidden, still read by assistive technology. */
export const srOnlyClass = css({ srOnly: true });
