import { css } from "../../../styled-system/css";

export const pageClass = css({
  display: "grid",
  gap: "6",
  maxW: "1200px",
  marginInline: "auto",
  p: { base: "4", md: "6" },
  width: "full",
});

export const pageTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "2xl", md: "3xl" },
  fontWeight: "normal",
  lineHeight: "1.2",
  marginBottom: "3",
});

export const sectionTitleClass = css({
  color: "zodiac.gold",
  fontFamily: "mono",
  fontSize: "sm",
  letterSpacing: "0.14em",
  marginBottom: "3",
  textTransform: "uppercase",
});

export const fieldLabelClass = css({
  color: "rgba(245, 240, 232, 0.75)",
  display: "block",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  marginBottom: "1.5",
  marginTop: "4",
  textTransform: "uppercase",
});
