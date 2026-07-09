import { Link } from "@tanstack/solid-router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Doc } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
} from "../components/ui";
import {
  createAction,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

function kindLabel(kind: Doc<"editorialArtifacts">["kind"]) {
  switch (kind) {
    case "experiment_recap":
      return "Experiment recap";
    case "what_changed_my_mind":
      return "What changed my mind";
    case "campaign_summary":
      return "Campaign summary";
    case "thesis_summary":
      return "Thesis summary";
  }
}

export function EditorialPage() {
  onMount(() => {
    document.title = "Editorial — Frequency Music";
  });

  const artifacts = createQueryWithStatus(
    convexApi.editorialArtifacts.list,
    () => ({
      limit: 50,
    }),
  );
  const missingWhyThisMatters = createQuery(
    convexApi.hypotheses.listMissingWhyThisMatters,
    () => ({
      limit: 20,
    }),
  );
  const exportForAstro = createAction(
    convexApi.editorialArtifacts.exportForAstro,
  );

  const [notice, setNotice] = createSignal<string | null>(null);
  const [exporting, setExporting] = createSignal(false);

  const rows = createMemo<Doc<"editorialArtifacts">[]>(
    () => (artifacts.data() ?? []) as Doc<"editorialArtifacts">[],
  );
  const publishedPublicCount = createMemo(
    () =>
      rows().filter(
        (row) => row.status === "published" && row.visibility === "public",
      ).length,
  );

  async function handleExport() {
    setExporting(true);
    setNotice(null);
    try {
      const result = await exportForAstro();
      setNotice(
        `Exported ${result.exportedCount} public artifact(s) to ${result.manifestPath}.`,
      );
    } catch (error) {
      setNotice(`Export failed: ${String(error)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section class={pageClass}>
      <UICard>
        <div
          class={css({
            display: "flex",
            justifyContent: "space-between",
            gap: "3",
            flexWrap: "wrap",
            alignItems: "flex-start",
          })}
        >
          <div>
            <h1 class={pageTitleClass}>Editorial</h1>
            <p
              class={css({
                color: "rgba(245, 240, 232, 0.64)",
                lineHeight: "1.6",
                maxWidth: "48rem",
              })}
            >
              Curate public-safe narrative artifacts here, then export only
              approved public snapshots for Astro consumption.
            </p>
            <div
              class={css({
                display: "flex",
                gap: "2",
                flexWrap: "wrap",
                mt: "3",
              })}
            >
              <UIBadge tone="gold">{rows().length} artifacts</UIBadge>
              <UIBadge tone="violet">
                {publishedPublicCount()} ready for export
              </UIBadge>
            </div>
          </div>
          <UIButton
            variant="outline"
            onClick={handleExport}
            disabled={exporting() || publishedPublicCount() === 0}
          >
            {exporting() ? "Exporting..." : "Export public snapshot"}
          </UIButton>
        </div>
        <Show when={notice()}>
          {(message) => (
            <p class={css({ color: "zodiac.cream", mt: "3" })}>{message()}</p>
          )}
        </Show>
      </UICard>

      <Show when={(missingWhyThisMatters() ?? []).length > 0}>
        <UICard>
          <h2 class={sectionTitleClass}>Phase 1 Audit</h2>
          <p class={css({ color: "rgba(245, 240, 232, 0.64)", mb: "3" })}>
            These hypotheses still have no <em>why this matters</em> copy and
            should be cleaned up before they feed public artifacts.
          </p>
          <div class={css({ display: "grid", gap: "2" })}>
            <For each={missingWhyThisMatters() ?? []}>
              {(hypothesis) => (
                <Link
                  to="/hypotheses/$hypothesisId"
                  params={{ hypothesisId: String(hypothesis._id) }}
                  class={css({
                    borderColor: "rgba(200, 168, 75, 0.18)",
                    borderRadius: "l2",
                    borderWidth: "1px",
                    color: "inherit",
                    display: "block",
                    p: "3",
                    textDecoration: "none",
                  })}
                >
                  <div class={css({ color: "zodiac.cream" })}>
                    {hypothesis.title}
                  </div>
                  <div
                    class={css({ color: "rgba(245, 240, 232, 0.58)", mt: "1" })}
                  >
                    {hypothesis.question}
                  </div>
                </Link>
              )}
            </For>
          </div>
        </UICard>
      </Show>

      <UICard>
        <h2 class={sectionTitleClass}>Artifacts</h2>
        <Show
          when={!artifacts.isLoading()}
          fallback={<p>Loading artifacts...</p>}
        >
          <Show
            when={rows().length > 0}
            fallback={
              <p class={css({ color: "rgba(245, 240, 232, 0.58)" })}>
                No editorial artifacts yet. Create a recap from a weekly brief,
                thesis, or campaign.
              </p>
            }
          >
            <div class={css({ display: "grid", gap: "3" })}>
              <For each={rows()}>
                {(artifact) => (
                  <Link
                    to="/editorial/$artifactId"
                    params={{ artifactId: String(artifact._id) }}
                    class={css({
                      borderColor: "rgba(200, 168, 75, 0.22)",
                      borderRadius: "l2",
                      borderWidth: "1px",
                      color: "inherit",
                      display: "block",
                      p: "4",
                      textDecoration: "none",
                    })}
                  >
                    <div
                      class={css({
                        display: "flex",
                        gap: "2",
                        flexWrap: "wrap",
                        mb: "2",
                      })}
                    >
                      <UIBadge tone="gold">{kindLabel(artifact.kind)}</UIBadge>
                      <UIBadge tone="cream">{artifact.status}</UIBadge>
                      <UIBadge tone="cream">{artifact.visibility}</UIBadge>
                      <UIBadge tone="violet">{artifact.evidenceStatus}</UIBadge>
                      <UIBadge tone="violet">
                        {artifact.publicEvidenceCards.length} evidence cards
                      </UIBadge>
                    </div>
                    <h3
                      class={css({
                        color: "zodiac.cream",
                        fontFamily: "display",
                        fontSize: "xl",
                        lineHeight: "1.4",
                        mb: "2",
                      })}
                    >
                      {artifact.title}
                    </h3>
                    <p class={css({ color: "rgba(245, 240, 232, 0.64)" })}>
                      {artifact.dek}
                    </p>
                  </Link>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </UICard>
    </section>
  );
}
