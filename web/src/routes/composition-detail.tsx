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

const lineItem = css({
  borderColor: "rgba(200, 168, 75, 0.18)",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "3",
});

export function CompositionDetailPage() {
  const params = useParams({ from: "/compositions/$compositionId" });
  const lineage = createQuery(convexApi.compositions.getLineage, () => ({
    id: params().compositionId as Id<"compositions">,
  }));

  createEffect(() => {
    const row = lineage()?.composition;
    if (row) document.title = `${row.title} — Frequency Music`;
  });

  return (
    <section class={pageClass}>
      <div>
        <Link to="/compositions" class={backLink}>
          <span aria-hidden="true">&larr;</span> Compositions
        </Link>
      </div>

      <Show
        when={lineage()}
        fallback={
          <UICard>
            <p class={css({ color: "zodiac.cream" })}>Loading composition...</p>
          </UICard>
        }
      >
        {(row) => (
          <UICard>
            <div class={css({ display: "flex", gap: "2", flexWrap: "wrap", mb: "2" })}>
              <UIBadge tone="gold">{row().composition.status}</UIBadge>
              <UIBadge tone="violet">{row().composition.artifactType}</UIBadge>
              <UIBadge tone="cream">{row().composition.version}</UIBadge>
              <Show when={row().summary.failureStatus}>
                {(status) => <UIBadge tone="violet">{status()}</UIBadge>}
              </Show>
            </div>

            <h1 class={detailTitleClass}>{row().composition.title}</h1>

            <p class={css({ color: "rgba(245, 240, 232, 0.62)", fontSize: "sm", lineHeight: "1.7" })}>
              Depth {row().summary.depth} in revision branch
              <Show when={row().summary.revisionVariable}>
                {(variable) => <> · changed variable: {variable()}</>}
              </Show>
              <Show when={row().summary.latestExpandVerdict}>
                {(verdict) => <> · latest expand verdict: {verdict()}</>}
              </Show>
            </p>

            <Show when={row().summary.failureStatus}>
              {(status) => (
                <>
                  <hr class={goldDivider} />
                  <div class={sectionLabel}>Archive Signal</div>
                  <p class={css({ color: "rgba(245, 240, 232, 0.76)", lineHeight: "1.7" })}>
                    This composition is currently classified as `{status()}` in the
                    derived failure archive.
                  </p>
                </>
              )}
            </Show>

            <hr class={goldDivider} />
            <div class={sectionLabel}>Lineage</div>
            <div class={css({ display: "grid", gap: "2" })}>
              <For each={row().ancestry}>
                {(ancestor) => (
                  <div class={lineItem}>
                    <Link
                      to="/compositions/$compositionId"
                      params={{ compositionId: String(ancestor._id) }}
                      class={css({ color: "zodiac.cream", textDecoration: "none" })}
                    >
                      {ancestor.title}
                    </Link>
                    <p class={css({ color: "rgba(245, 240, 232, 0.55)", fontSize: "sm", mt: "1" })}>
                      {ancestor.version}
                      <Show when={ancestor.revisionVariable}>
                        {(variable) => <> · variable: {variable()}</>}
                      </Show>
                    </p>
                  </div>
                )}
              </For>
              <div class={lineItem}>
                <div class={css({ color: "zodiac.gold" })}>{row().composition.title}</div>
                <p class={css({ color: "rgba(245, 240, 232, 0.55)", fontSize: "sm", mt: "1" })}>
                  current node
                </p>
              </div>
            </div>

            <Show when={row().children.length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Direct Revisions</div>
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={row().children}>
                  {(child) => (
                    <div class={lineItem}>
                      <Link
                        to="/compositions/$compositionId"
                        params={{ compositionId: String(child._id) }}
                        class={css({ color: "zodiac.cream", textDecoration: "none" })}
                      >
                        {child.title}
                      </Link>
                      <p class={css({ color: "rgba(245, 240, 232, 0.55)", fontSize: "sm", mt: "1" })}>
                        {child.version}
                        <Show when={child.revisionVariable}>
                          {(variable) => <> · variable: {variable()}</>}
                        </Show>
                      </p>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <hr class={goldDivider} />
            <div class={sectionLabel}>Provenance</div>
            <div class={css({ display: "grid", gap: "3" })}>
              <Show when={row().recipe}>
                {(recipe) => (
                  <div class={lineItem}>
                    <div class={css({ color: "zodiac.gold", fontSize: "sm", mb: "1" })}>Recipe</div>
                    <Link
                      to="/recipes/$recipeId"
                      params={{ recipeId: String(recipe()._id) }}
                      class={css({ color: "zodiac.cream", textDecoration: "none" })}
                    >
                      {recipe().title}
                    </Link>
                  </div>
                )}
              </Show>
              <Show when={row().hypothesis}>
                {(hypothesis) => (
                  <div class={lineItem}>
                    <div class={css({ color: "zodiac.gold", fontSize: "sm", mb: "1" })}>Hypothesis</div>
                    <Link
                      to="/hypotheses/$hypothesisId"
                      params={{ hypothesisId: String(hypothesis()._id) }}
                      class={css({ color: "zodiac.cream", textDecoration: "none" })}
                    >
                      {hypothesis().title}
                    </Link>
                  </div>
                )}
              </Show>
              <Show when={row().thesis}>
                {(thesis) => (
                  <div class={lineItem}>
                    <div class={css({ color: "zodiac.gold", fontSize: "sm", mb: "1" })}>Thesis</div>
                    <Link
                      to="/theses/$thesisId"
                      params={{ thesisId: String(thesis()._id) }}
                      class={css({ color: "zodiac.cream", textDecoration: "none" })}
                    >
                      {thesis().title}
                    </Link>
                  </div>
                )}
              </Show>
            </div>

            <Show when={row().sources.length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Linked Sources</div>
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={row().sources}>
                  {(source) => (
                    <div class={lineItem}>
                      <div class={css({ color: "zodiac.cream" })}>
                        {source.title ?? "Untitled source"}
                      </div>
                      <p class={css({ color: "rgba(245, 240, 232, 0.55)", fontSize: "sm", mt: "1" })}>
                        {source.type}
                      </p>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <hr class={goldDivider} />
            <div class={sectionLabel}>Listening History</div>
            <Show
              when={row().listeningSessions.length > 0}
              fallback={
                <p class={css({ color: "rgba(245, 240, 232, 0.58)" })}>
                  No listening sessions logged for this composition yet.
                </p>
              }
            >
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={row().listeningSessions}>
                  {(session) => (
                    <div class={lineItem}>
                      <div class={css({ display: "flex", gap: "2", flexWrap: "wrap", mb: "1" })}>
                        <Show when={session.expandVerdict}>
                          {(verdict) => <UIBadge tone="gold">{verdict()}</UIBadge>}
                        </Show>
                        <Show when={session.ratings.expandability !== undefined}>
                          {(score) => <UIBadge tone="cream">expandability {score()}</UIBadge>}
                        </Show>
                      </div>
                      <p class={css({ color: "rgba(245, 240, 232, 0.7)", lineHeight: "1.7" })}>
                        {session.feedbackMd}
                      </p>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </UICard>
        )}
      </Show>
    </section>
  );
}
