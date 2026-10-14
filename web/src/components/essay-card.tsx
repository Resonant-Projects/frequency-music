import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { css, cx } from "../../styled-system/css";
import type { EssaySummary } from "../lib/essays";
import { UIBadge } from "./ui";

/** Gold-washed hero surface shared by the essay archive and an essay page. */
export const essayHeroClass = css({
  position: "relative",
  overflow: "hidden",
  bg: "[linear-gradient(135deg, {colors.zodiac.gold/16}, {colors.zodiac.void/88} 58%)]",
  _before: {
    content: '""',
    position: "absolute",
    inset: "[auto -10% -30% auto]",
    width: "72",
    height: "72",
    borderRadius: "full",
    background:
      "[radial-gradient(circle, {colors.zodiac.gold/22}, transparent 68%)]",
    filter: "[blur(14px)]",
    pointerEvents: "none",
  },
});

/** The large display title of the archive hero and of an essay page. */
export const essayDisplayTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "5xl", md: "6xl" },
  fontWeight: "normal",
  lineHeight: "poster",
  letterSpacing: "display",
});

/** The badge row (date, read time, word count) above an essay title. */
export const essayMetaClass = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "2",
  alignItems: "center",
});

/**
 * A card that is one essay link. The link lives inside the card's heading
 * (`EssayTitleLink`) and its `::after` overlay stretches the hit area over the
 * whole card; the card owns the hover lift and draws the focus ring while that
 * link is focused. Cards are flat at rest.
 */
export const essayCardLiftClass = css({
  position: "relative",
  transition:
    "[transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease]",
  _hover: {
    transform: "translateY(-3px)",
    borderColor: "zodiac.gold/48",
    boxShadow: "cardHover",
    _motionReduce: { transform: "none" },
  },
  "&:has(a:focus-visible)": {
    borderColor: "zodiac.gold/48",
    outline: "focus",
    outlineColor: "zodiac.gold",
    outlineOffset: "0.5",
  },
});

const essayCardClass = css({
  display: "grid",
  alignContent: "start",
  gap: "2",
  minHeight: { base: "auto", md: "[13.5rem]" },
  bg: "zodiac.void/92",
  borderColor: "zodiac.gold/22",
  borderRadius: "l3",
  borderWidth: "1px",
  color: "zodiac.cream",
  p: "5",
});

const essayCardTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "xl", md: "2xl" },
  fontWeight: "normal",
  lineHeight: "poster",
  letterSpacing: "display",
});

const essayCardExcerptClass = css({
  color: "zodiac.cream/68",
  fontSize: "sm",
  fontWeight: "normal",
  lineHeight: "dense",
});

const essayCardFooterClass = css({
  color: "zodiac.cream/66",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "labelWider",
  textTransform: "uppercase",
  mt: "3",
});

// Essay cards use `l3` corners, so this is the essay twin of
// `entityCardTitleLinkClass` (whose overlay is `l2`).
const essayTitleLinkClass = css({
  color: "inherit",
  textDecoration: "none",
  _after: {
    borderRadius: "l3",
    content: '""',
    inset: "0",
    position: "absolute",
  },
  // The card draws the ring (see `essayCardLiftClass`).
  _focusVisible: { outline: "none" },
});

/** An essay's date badge, with a machine-readable `<time>` when it parses. */
export function EssayDateBadge(props: { essay: EssaySummary }) {
  const label = () => props.essay.dateLabel ?? "Research essay";
  return (
    <UIBadge tone="gold">
      <Show when={props.essay.dateValue} fallback={label()}>
        {(value) => (
          <time datetime={new Date(value()).toISOString()}>{label()}</time>
        )}
      </Show>
    </UIBadge>
  );
}

/**
 * The essay title as the card's one link; place it inside the card's heading
 * on an `essayCardLiftClass` card so its overlay covers the whole card.
 */
export function EssayTitleLink(props: { essay: EssaySummary }) {
  return (
    <Link
      to="/essays/$essaySlug"
      params={{ essaySlug: props.essay.slug }}
      class={essayTitleLinkClass}
    >
      {props.essay.title}
    </Link>
  );
}

/** An archive or related-essay card; the whole card links to the essay. */
export function EssayCard(props: { essay: EssaySummary; footer?: boolean }) {
  return (
    <article class={cx(essayCardClass, essayCardLiftClass)}>
      <div class={essayMetaClass}>
        <EssayDateBadge essay={props.essay} />
        <UIBadge tone="cream">{props.essay.readTimeMinutes} min</UIBadge>
      </div>
      <h3 class={essayCardTitleClass}>
        <EssayTitleLink essay={props.essay} />
      </h3>
      <p class={essayCardExcerptClass}>{props.essay.excerpt}</p>
      <Show when={props.footer}>
        <div class={essayCardFooterClass} aria-hidden="true">
          Read essay
        </div>
      </Show>
    </article>
  );
}
