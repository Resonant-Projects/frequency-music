import { Link, linkOptions } from "@tanstack/solid-router";
import { css, cx } from "../../styled-system/css";
import { linkCardClass } from "./entity-card";
import { badgeRowClass, UIBadge } from "./ui";

/** One steering recommendation, as stored on a weekly brief or previewed live. */
export type RecommendedActionCardAction = {
  kind: string;
  targetType: "hypothesis" | "recipe" | "composition";
  targetId: string;
  durationBucket: string;
  reason: string;
};

const badgesClass = cx(badgeRowClass, css({ mb: "1" }));

const targetClass = css({ color: "zodiac.cream", mb: "1" });

const reasonClass = css({ color: "zodiac.cream/68" });

/** The detail route a recommendation's target opens. */
function actionTarget(action: RecommendedActionCardAction) {
  switch (action.targetType) {
    case "hypothesis":
      return linkOptions({
        to: "/hypotheses/$hypothesisId",
        params: { hypothesisId: action.targetId },
      });
    case "recipe":
      return linkOptions({
        to: "/recipes/$recipeId",
        params: { recipeId: action.targetId },
      });
    case "composition":
      return linkOptions({
        to: "/compositions/$compositionId",
        params: { compositionId: action.targetId },
      });
  }
}

/**
 * A recommended next action linking to its hypothesis, recipe or composition.
 * Shared by the Weekly Turns steering preview and the weekly brief detail page.
 */
export function RecommendedActionCard(props: {
  action: RecommendedActionCardAction;
}) {
  return (
    <Link {...actionTarget(props.action)} class={linkCardClass}>
      <div class={badgesClass}>
        <UIBadge tone="gold">{props.action.durationBucket}</UIBadge>
        <UIBadge tone="cream">{props.action.kind}</UIBadge>
      </div>
      <div class={targetClass}>
        {props.action.targetType} {props.action.targetId.slice(-6)}
      </div>
      <p class={reasonClass}>{props.action.reason}</p>
    </Link>
  );
}
