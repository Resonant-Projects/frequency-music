import { Link } from "@tanstack/solid-router";
import { createUniqueId, Show } from "solid-js";
import { css, cx } from "../../styled-system/css";
import type { EssaySummary } from "../lib/essays";
import { focusRingClass, UIBadge } from "./ui";

/** Gold-washed hero surface shared by the essay archive and an essay page. */
export const essayHeroClass = css({
  position: "relative",
  overflow: "hidden",
  bg: "linear-gradient(135deg, {colors.zodiac.gold/16}, {colors.zodiac.void/88} 58%)",
  _before: {
    content: '""',
    position: "absolute",
    inset: "auto -10% -30% auto",
    width: "18rem",
    height: "18rem",
    borderRadius: "full",
    background:
      "radial-gradient(circle, {colors.zodiac.gold/22}, transparent 68%)",
    filter: "blur(14px)",
    pointerEvents: "none",
  },
});

/** The large display title of the archive hero and of an essay page. */
export const essayDisplayTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "44px", md: "56px" },
  fontWeight: "normal",
  lineHeight: "0.96",
  letterSpacing: "-0.015em",
  m: "0",
});

/** The badge row (date, read time, word count) above an essay title. */
export const essayMetaClass = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "2",
  alignItems: "center",
});

/** Hover lift for a whole-card essay link. Cards are flat at rest. */
export const essayCardLiftClass = css({
  transition:
    "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
  _hover: {
    transform: "translateY(-3px)",
    borderColor: "zodiac.gold/48",
    boxShadow: "cardHover",
    _motionReduce: { transform: "none" },
  },
});

const essayCardClass = css({
  position: "relative",
  display: "grid",
  alignContent: "start",
  gap: "2",
  minHeight: { base: "auto", md: "13.5rem" },
  bg: "zodiac.void/92",
  borderColor: "zodiac.gold/22",
  borderRadius: "l3",
  borderWidth: "1px",
  color: "zodiac.cream",
  p: "16px 18px",
});

const essayCardTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "22px", md: "24px" },
  fontWeight: "normal",
  lineHeight: "1.08",
  letterSpacing: "-0.01em",
  m: "0",
});

const essayCardExcerptClass = css({
  color: "zodiac.cream/68",
  fontSize: "14px",
  fontWeight: "400",
  lineHeight: "1.65",
  m: "0",
});

const essayCardFooterClass = css({
  color: "zodiac.cream/66",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.26em",
  textTransform: "uppercase",
  mt: "3",
});

// Covers the whole card so it stays one click target, while the heading sits
// outside the anchor and names it through aria-labelledby.
const stretchedLinkClass = css({
  position: "absolute",
  inset: "0",
  zIndex: "1",
  borderRadius: "l3",
});

/** An essay's date badge, with a machine-readable `<time>` when it parses. */
export function EssayDateBadge(props: { essay: EssaySummary }) {
  const iso = () =>
    props.essay.dateValue === null
      ? null
      : new Date(props.essay.dateValue).toISOString();
  return (
    <UIBadge tone="gold">
      <Show when={iso()} fallback={props.essay.dateLabel ?? "Research essay"}>
        {(datetime) => (
          <time datetime={datetime()}>
            {props.essay.dateLabel ?? "Research essay"}
          </time>
        )}
      </Show>
    </UIBadge>
  );
}

/**
 * A link that covers its `position: relative` parent card. It has no content
 * of its own: `labelledBy` must name the card's heading id.
 */
export function EssayStretchedLink(props: {
  slug: string;
  labelledBy: string;
}) {
  return (
    <Link
      to="/essays/$essaySlug"
      params={{ essaySlug: props.slug }}
      aria-labelledby={props.labelledBy}
      class={cx(focusRingClass, stretchedLinkClass)}
    />
  );
}

/** An archive or related-essay card; the whole card links to the essay. */
export function EssayCard(props: { essay: EssaySummary; footer?: boolean }) {
  const titleId = createUniqueId();
  return (
    <article class={cx(essayCardClass, essayCardLiftClass)}>
      <div class={essayMetaClass}>
        <EssayDateBadge essay={props.essay} />
        <UIBadge tone="cream">{props.essay.readTimeMinutes} min</UIBadge>
      </div>
      <h3 id={titleId} class={essayCardTitleClass}>
        {props.essay.title}
      </h3>
      <p class={essayCardExcerptClass}>{props.essay.excerpt}</p>
      <Show when={props.footer}>
        <div class={essayCardFooterClass} aria-hidden="true">
          Read essay
        </div>
      </Show>
      <EssayStretchedLink slug={props.essay.slug} labelledBy={titleId} />
    </article>
  );
}
