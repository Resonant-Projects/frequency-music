import { css } from "../../styled-system/css";

/**
 * The entity-row card shared by the hypothesis, thesis, recipe and composition
 * lists and their detail pages: a 1px gold hairline at the resting 22% alpha
 * (DESIGN.md Cards), `l2` corners, 1rem of padding.
 */
const entityCardBase = {
  borderColor: "zodiac.gold/22",
  borderRadius: "l2",
  borderStyle: "solid",
  borderWidth: "1px",
} as const;

/** A static entity card (no link of its own). */
export const entityCardClass = css({ ...entityCardBase, p: "4" });

/** The compact cell used for nested rows on detail pages. */
export const entityCellClass = css({ ...entityCardBase, p: "3" });

/**
 * A card that is one link. The link itself lives inside the card's heading
 * (`entityCardTitleLinkClass`) so no heading sits inside an `<a>`; its
 * `::after` overlay stretches the hit area over the whole card. The card owns
 * the hover lift and draws the focus ring while that link is focused.
 */
export const entityCardLinkClass = css({
  ...entityCardBase,
  p: "4",
  position: "relative",
  transitionDuration: "normal",
  transitionProperty: "border-color, box-shadow",
  transitionTimingFunction: "default",
  _hover: { borderColor: "zodiac.gold/45" },
  "&:has(a:focus-visible)": {
    borderColor: "zodiac.gold/45",
    outline: "2px solid",
    outlineColor: "zodiac.gold",
    outlineOffset: "2px",
  },
});

/** The stretched title link inside an `entityCardLinkClass` card's heading. */
export const entityCardTitleLinkClass = css({
  color: "inherit",
  textDecoration: "none",
  _after: {
    borderRadius: "l2",
    content: '""',
    inset: "0",
    position: "absolute",
  },
  // The card draws the ring (see `entityCardLinkClass`).
  _focusVisible: { outline: "none" },
});

/**
 * A bordered block that is itself a link (recommended actions, audit links,
 * failure hits): hairline at 20%, lifted on hover, ringed on focus.
 */
export const linkCardClass = css({
  ...entityCardBase,
  borderColor: "zodiac.gold/20",
  color: "zodiac.cream",
  display: "block",
  p: "3",
  textDecoration: "none",
  transitionDuration: "normal",
  transitionProperty: "border-color",
  transitionTimingFunction: "default",
  _hover: { borderColor: "zodiac.gold/45" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "zodiac.gold",
    outlineOffset: "2px",
  },
});
