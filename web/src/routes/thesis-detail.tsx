import { Link, useParams } from "@tanstack/solid-router";
import { createEffect, For, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  UIBadge,
  UICard,
  backLink,
  detailTitleClass,
  goldDivider,
  pageClass,
  sectionLabel,
} from "../components/ui";
import { createQuery } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

const statGrid = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: { base: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
});

const statCard = css({
  bg: "rgba(245, 240, 232, 0.03)",
  borderColor: "rgba(200, 168, 75, 0.18)",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "3",
});

const linkList = css({
  display: "grid",
  gap: "2",
});

export function ThesisDetailPage() {
  const params = useParams({ from: "/theses/$thesisId" });
  const detail = createQuery(convexApi.theses.getDetail, () => ({
    id: params().thesisId as Id<"theses">,
  }));

  createEffect(() => {
    const thesis = detail()?.thesis;
    if (thesis) document.title = `${thesis.title} — Frequency Music`;
  });

  return (
    <section class={pageClass}>
      <div>
        <Link to="/theses" class={backLink}>
          <span aria-hidden="true">&larr;</span> Theses
        </Link>
      </div>

      <Show
        when={detail()}
        fallback={
          <UICard>
            <p class={css({ color: "zodiac.cream" })}>Loading thesis...</p>
          </UICard>
        }
      >
        {(row) => (
          <>
            <UICard>
              <div class={css({ display: "flex", gap: "2", flexWrap: "wrap", mb: "2" })}>
                <UIBadge tone="gold">{row().thesis.status}</UIBadge>
                <UIBadge tone="cream">{row().thesis.visibility}</UIBadge>
                <UIBadge tone="violet">{row().hypotheses.length} hypotheses</UIBadge>
                <UIBadge tone="violet">{row().recipes.length} recipes</UIBadge>
                <UIBadge tone="violet">{row().compositions.length} compositions</UIBadge>
              </div>

              <h1 class={detailTitleClass}>{row().thesis.title}</h1>
              <p class={css({ color: "rgba(245, 240, 232, 0.78)", fontSize: "lg", lineHeight: "1.7" })}>
                {row().thesis.statement}
              </p>

              <Show when={row().thesis.descriptionMd}>
                {(description) => (
                  <>
                    <hr class={goldDivider} />
                    <div class={sectionLabel}>Description</div>
                    <p class={css({ color: "rgba(245, 240, 232, 0.7)", lineHeight: "1.7", whiteSpace: "pre-wrap" })}>
                      {description()}
                    </p>
                  </>
                )}
              </Show>

              <hr class={goldDivider} />
              <div class={sectionLabel}>Thesis Signals</div>
              <div class={statGrid}>
                <div class={statCard}>
                  <div class={css({ color: "zodiac.gold", fontSize: "2xl" })}>
                    {row().stats.contradictionCount}
                  </div>
                  <div class={css({ color: "rgba(245, 240, 232, 0.58)", fontSize: "sm" })}>
                    contradictions
                  </div>
                </div>
                <div class={statCard}>
                  <div class={css({ color: "zodiac.gold", fontSize: "2xl" })}>
                    {row().stats.activeCount}
                  </div>
                  <div class={css({ color: "rgba(245, 240, 232, 0.58)", fontSize: "sm" })}>
                    active
                  </div>
                </div>
                <div class={statCard}>
                  <div class={css({ color: "zodiac.gold", fontSize: "2xl" })}>
                    {row().stats.evaluatedCount}
                  </div>
                  <div class={css({ color: "rgba(245, 240, 232, 0.58)", fontSize: "sm" })}>
                    evaluated
                  </div>
                </div>
                <div class={statCard}>
                  <div class={css({ color: "zodiac.gold", fontSize: "2xl" })}>
                    {row().stats.retiredCount}
                  </div>
                  <div class={css({ color: "rgba(245, 240, 232, 0.58)", fontSize: "sm" })}>
                    retired
                  </div>
                </div>
              </div>

              <hr class={goldDivider} />
              <div class={sectionLabel}>Hypotheses</div>
              <div class={linkList}>
                <For each={row().hypotheses}>
                  {(hypothesis) => (
                    <Link
                      to="/hypotheses/$hypothesisId"
                      params={{ hypothesisId: String(hypothesis._id) }}
                      class={css({ color: "rgba(245, 240, 232, 0.78)", textDecoration: "none" })}
                    >
                      {hypothesis.title}
                    </Link>
                  )}
                </For>
              </div>

              <Show when={row().recipes.length > 0}>
                <hr class={goldDivider} />
                <div class={sectionLabel}>Recipes</div>
                <div class={linkList}>
                  <For each={row().recipes}>
                    {(recipe) => (
                      <Link
                        to="/recipes/$recipeId"
                        params={{ recipeId: String(recipe._id) }}
                        class={css({ color: "rgba(245, 240, 232, 0.78)", textDecoration: "none" })}
                      >
                        {recipe.title}
                      </Link>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={row().compositions.length > 0}>
                <hr class={goldDivider} />
                <div class={sectionLabel}>Compositions</div>
                <div class={linkList}>
                  <For each={row().compositions}>
                    {(composition) => (
                      <Link
                        to="/compositions/$compositionId"
                        params={{ compositionId: String(composition._id) }}
                        class={css({ color: "rgba(245, 240, 232, 0.78)", textDecoration: "none" })}
                      >
                        {composition.title}
                      </Link>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={row().recentWeeklyBriefIds.length > 0}>
                <hr class={goldDivider} />
                <div class={sectionLabel}>Recent Weekly Briefs</div>
                <div class={linkList}>
                  <For each={row().recentWeeklyBriefIds}>
                    {(briefId) => (
                      <Link
                        to="/weekly-turns/$briefId"
                        params={{ briefId: String(briefId) }}
                        class={css({ color: "rgba(245, 240, 232, 0.78)", textDecoration: "none" })}
                      >
                        Weekly brief {String(briefId).slice(-6)}
                      </Link>
                    )}
                  </For>
                </div>
              </Show>
            </UICard>
          </>
        )}
      </Show>
    </section>
  );
}
