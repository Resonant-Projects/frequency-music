import { createSignal, For, onMount, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UICard,
  UISelect,
} from "../components/ui";
import { createQuery, createQueryWithStatus } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

const rowClass = css({
  borderColor: "rgba(200, 168, 75, 0.18)",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "4",
});

const REASONS = [
  "contradicted_hypothesis",
  "retired_hypothesis",
  "archived_recipe",
  "low_expandability_composition",
  "repeat_no_expand_composition",
] as const;

export function FailuresPage() {
  onMount(() => {
    document.title = "Failure Archive — Frequency Music";
  });

  const [reason, setReason] = createSignal("");
  const [thesisId, setThesisId] = createSignal("");

  const theses = createQuery(convexApi.theses.list, () => ({ limit: 100 }));
  const archive = createQueryWithStatus(convexApi.failures.listArchive, () => ({
    limit: 100,
    reason: reason() ? (reason() as (typeof REASONS)[number]) : undefined,
    thesisId: thesisId() ? (thesisId() as Id<"theses">) : undefined,
  }));

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Failure Archive</h1>
        <p class={css({ color: "rgba(245, 240, 232, 0.62)", lineHeight: "1.6" })}>
          Contradictions and low-yield paths stay visible here so the system can learn honestly
          instead of silently discarding reversals.
        </p>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Filters</h2>
        <div
          class={css({
            display: "grid",
            gap: "3",
            gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
          })}
        >
          <div>
            <label
              class={css({
                color: "rgba(245, 240, 232, 0.7)",
                display: "block",
                mb: "2",
              })}
              for="failure-reason"
            >
              Reason
            </label>
            <UISelect
              id="failure-reason"
              value={reason()}
              onChange={(event) => setReason(event.currentTarget.value)}
            >
              <option value="">All reasons</option>
              <For each={REASONS}>{(value) => <option value={value}>{value}</option>}</For>
            </UISelect>
          </div>
          <div>
            <label
              class={css({
                color: "rgba(245, 240, 232, 0.7)",
                display: "block",
                mb: "2",
              })}
              for="failure-thesis"
            >
              Thesis
            </label>
            <UISelect
              id="failure-thesis"
              value={thesisId()}
              onChange={(event) => setThesisId(event.currentTarget.value)}
            >
              <option value="">All theses</option>
              <For each={theses() ?? []}>
                {(thesis: { _id: string; title: string }) => (
                  <option value={String(thesis._id)}>{thesis.title}</option>
                )}
              </For>
            </UISelect>
          </div>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Archive</h2>
        <Show
          when={!archive.isLoading() && (archive.data() ?? []).length > 0}
          fallback={
            <p class={css({ color: "rgba(245, 240, 232, 0.58)" })}>
              {archive.isLoading()
                ? "Loading..."
                : "No archived failures match the current filters."}
            </p>
          }
        >
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={archive.data() ?? []}>
              {(entry) => (
                <div id={entry.key} data-testid="failure-row" class={rowClass}>
                  <div
                    class={css({
                      display: "flex",
                      gap: "2",
                      flexWrap: "wrap",
                      mb: "2",
                    })}
                  >
                    <UIBadge tone="gold">{entry.reason}</UIBadge>
                    <UIBadge tone="cream">{entry.recommendedNextAction}</UIBadge>
                  </div>
                  <h3
                    class={css({
                      color: "zodiac.cream",
                      fontSize: "xl",
                      mb: "2",
                    })}
                  >
                    {entry.title}
                  </h3>
                  <p
                    class={css({
                      color: "rgba(245, 240, 232, 0.75)",
                      lineHeight: "1.7",
                      mb: "2",
                    })}
                  >
                    {entry.explanation}
                  </p>
                  <p
                    class={css({
                      color: "rgba(245, 240, 232, 0.58)",
                      lineHeight: "1.7",
                      mb: "2",
                    })}
                  >
                    {entry.summary}
                  </p>
                  <div
                    class={css({
                      display: "flex",
                      gap: "3",
                      flexWrap: "wrap",
                      fontSize: "sm",
                    })}
                  >
                    <Show when={entry.hypothesisId}>
                      <a
                        href={`/hypotheses/${entry.hypothesisId}`}
                        class={css({ color: "zodiac.violet" })}
                      >
                        Hypothesis
                      </a>
                    </Show>
                    <Show when={entry.recipeId}>
                      <a
                        href={`/recipes/${entry.recipeId}`}
                        class={css({ color: "zodiac.violet" })}
                      >
                        Recipe
                      </a>
                    </Show>
                    <Show when={entry.compositionId}>
                      <a
                        href={`/compositions/${entry.compositionId}`}
                        class={css({ color: "zodiac.violet" })}
                      >
                        Composition
                      </a>
                    </Show>
                    <Show when={entry.thesisId}>
                      <a href={`/theses/${entry.thesisId}`} class={css({ color: "zodiac.violet" })}>
                        Thesis
                      </a>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </UICard>
    </section>
  );
}
