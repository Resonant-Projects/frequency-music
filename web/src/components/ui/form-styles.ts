import { css } from "../../../styled-system/css";

export const pageClass = css({
  display: "grid",
  gap: "6",
  p: { base: "4", md: "6" },
});

export const sectionTitleClass = css({
  color: "zodiac.gold",
  fontSize: "lg",
  letterSpacing: "0.12em",
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
