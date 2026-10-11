import { Link } from "@tanstack/solid-router";
import { css, cx } from "../../styled-system/css";
import { focusRingClass, UIBadge } from "./ui";

/** One steering recommendation, as stored on a weekly brief or previewed live. */
export type RecommendedActionCardAction = {
  kind: string;
  targetType: "hypothesis" | "recipe" | "composition";
  targetId: string;
  durationBucket: string;
  reason: string;
};

const linkClass = cx(
  css({
    borderColor: "zodiac.gold/20",
    borderRadius: "l2",
    borderWidth: "1px",
    color: "inherit",
    display: "block",
    p: "3",
    textDecoration: "none",
    transitionDuration: "normal",
    transitionProperty: "border-color",
    _hover: { borderColor: "zodiac.gold/45" },
  }),
  focusRingClass,
);

const badgeRowClass = css({
  display: "flex",
  gap: "2",
  flexWrap: "wrap",
  mb: "1",
});

const targetClass = css({ color: "zodiac.cream", mb: "1" });

const reasonClass = css({ color: "zodiac.cream/68" });

/**
 * A recommended next action linking to its hypothesis, recipe or composition.
 * Shared by the Weekly Turns steering preview and the weekly brief detail page.
 */
export function RecommendedActionCard(props: {
  action: RecommendedActionCardAction;
}) {
  const body = () => (
    <>
      <div class={badgeRowClass}>
        <UIBadge tone="gold">{props.action.durationBucket}</UIBadge>
        <UIBadge tone="cream">{props.action.kind}</UIBadge>
      </div>
      <div class={targetClass}>
        {props.action.targetType} {props.action.targetId.slice(-6)}
      </div>
      <p class={reasonClass}>{props.action.reason}</p>
    </>
  );

  return props.action.targetType === "hypothesis" ? (
    <Link
      to="/hypotheses/$hypothesisId"
      params={{ hypothesisId: props.action.targetId }}
      class={linkClass}
    >
      {body()}
    </Link>
  ) : props.action.targetType === "recipe" ? (
    <Link
      to="/recipes/$recipeId"
      params={{ recipeId: props.action.targetId }}
      class={linkClass}
    >
      {body()}
    </Link>
  ) : (
    <Link
      to="/compositions/$compositionId"
      params={{ compositionId: props.action.targetId }}
      class={linkClass}
    >
      {body()}
    </Link>
  );
}
