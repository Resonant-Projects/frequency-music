import { Link } from "@tanstack/solid-router";
import { createSignal, For, onMount, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import {
  fieldLabelClass,
  focusRingClass,
  helperClass,
  pageClass,
  pageTitleClass,
  proseClass,
  sectionTitleClass,
  UIBadge,
  UICard,
  UINotice,
  UISelect,
} from "../components/ui";
import { createQuery, createQueryWithStatus } from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

const rowClass = css({
  borderColor: "zodiac.gold/18",
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
type Reason = (typeof REASONS)[number];

const REASON_LABELS: Record<Reason, string> = {
  contradicted_hypothesis: "Contradicted hypothesis",
  retired_hypothesis: "Retired hypothesis",
  archived_recipe: "Archived recipe",
  low_expandability_composition: "Low-expandability composition",
  repeat_no_expand_composition: "Repeated no-expand composition",
};
const reasonLabel = (value: string) => REASON_LABELS[value as Reason] ?? value;

// Standalone links to the related records: violet text (provisional work),
// at least 24px tall (44px on touch), with the gold focus ring.
const archiveLinkClass = cx(
  css({
    alignItems: "center",
    color: "zodiac.violetText",
    display: "inline-flex",
    minH: "6",
    _hover: { textDecoration: "underline" },
    _coarsePointer: { minH: "11" },
  }),
  focusRingClass,
);

export function FailuresPage() {
  onMount(() => {
    document.title = "Failure Archive — Frequency Music";
  });

  const [reason, setReason] = createSignal("");
  const [thesisId, setThesisId] = createSignal("");

  const theses = createQuery(api.theses.list, () => ({ limit: 100 }));
  const archive = createQueryWithStatus(api.failures.listArchive, () => ({
    limit: 100,
    reason: reason() ? (reason() as Reason) : undefined,
    thesisId: thesisId() ? (thesisId() as Id<"theses">) : undefined,
  }));

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Failure Archive</h1>
        <p class={helperClass}>
          Contradictions and low-yield paths stay visible here so the system can
          learn honestly instead of silently discarding reversals.
        </p>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Filters</h2>
        <div
          class={css({
            display: "grid",
            gap: "3",
            gridTemplateColumns: {
              base: "minmax(0, 1fr)",
              md: "repeat(2, minmax(0, 1fr))",
            },
          })}
        >
          <div>
            <label class={fieldLabelClass} for="failure-reason">
              Reason
            </label>
            <UISelect
              id="failure-reason"
              value={reason()}
              onChange={(event) => setReason(event.currentTarget.value)}
            >
              <option value="">All reasons</option>
              <For each={REASONS}>
                {(value) => (
                  <option value={value}>{REASON_LABELS[value]}</option>
                )}
              </For>
            </UISelect>
          </div>
          <div>
            <label class={fieldLabelClass} for="failure-thesis">
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
        <UINotice
          status={
            archive.isLoading()
              ? "Loading..."
              : !archive.isError() && (archive.data() ?? []).length === 0
                ? "No archived failures match the current filters."
                : null
          }
          error={
            archive.isError()
              ? `Unable to load the failure archive: ${archive.error()?.message ?? "unknown error"}`
              : null
          }
        />
        <Show when={!archive.isLoading() && (archive.data() ?? []).length > 0}>
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={archive.data() ?? []}>
              {(entry) => (
                <div
                  id={entry.key}
                  tabIndex={-1}
                  data-testid="failure-row"
                  class={rowClass}
                >
                  <div
                    class={css({
                      display: "flex",
                      gap: "2",
                      flexWrap: "wrap",
                      mb: "2",
                    })}
                  >
                    <UIBadge tone="gold">{reasonLabel(entry.reason)}</UIBadge>
                    <UIBadge tone="cream">
                      {entry.recommendedNextAction}
                    </UIBadge>
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
                  <p class={cx(proseClass, css({ mb: "2" }))}>
                    {entry.explanation}
                  </p>
                  <p class={cx(helperClass, css({ mb: "2" }))}>
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
                      {(hypothesisId) => (
                        <Link
                          to="/hypotheses/$hypothesisId"
                          params={{ hypothesisId: String(hypothesisId()) }}
                          aria-label={`Hypothesis for ${entry.title}`}
                          class={archiveLinkClass}
                        >
                          Hypothesis
                        </Link>
                      )}
                    </Show>
                    <Show when={entry.recipeId}>
                      {(recipeId) => (
                        <Link
                          to="/recipes/$recipeId"
                          params={{ recipeId: String(recipeId()) }}
                          aria-label={`Recipe for ${entry.title}`}
                          class={archiveLinkClass}
                        >
                          Recipe
                        </Link>
                      )}
                    </Show>
                    <Show when={entry.compositionId}>
                      {(compositionId) => (
                        <Link
                          to="/compositions/$compositionId"
                          params={{ compositionId: String(compositionId()) }}
                          aria-label={`Composition for ${entry.title}`}
                          class={archiveLinkClass}
                        >
                          Composition
                        </Link>
                      )}
                    </Show>
                    <Show when={entry.thesisId}>
                      {(thesisId) => (
                        <Link
                          to="/theses/$thesisId"
                          params={{ thesisId: String(thesisId()) }}
                          aria-label={`Thesis for ${entry.title}`}
                          class={archiveLinkClass}
                        >
                          Thesis
                        </Link>
                      )}
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
