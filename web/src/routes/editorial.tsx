import { Link } from "@tanstack/solid-router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Doc } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import {
  entityCardLinkClass,
  entityCardTitleLinkClass,
  linkCardClass,
} from "../components/entity-card";
import {
  badgeRowClass,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIList,
  UINotice,
} from "../components/ui";
import {
  createAction,
  createQueryWithStatus,
  describeError,
} from "../integrations/convex";
import {
  evidenceStatusTone,
  formatEditorialKind,
} from "../lib/editorial-format";
import { api } from "../../../convex/_generated/api";

const auditListClass = css({ display: "grid", gap: "2" });
const artifactListClass = css({ display: "grid", gap: "3" });
const artifactBadgeRowClass = cx(badgeRowClass, css({ mb: "2" }));
const artifactTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: "xl",
  lineHeight: "1.4",
  mb: "2",
});
const mutedClass = css({ color: "zodiac.cream/66" });
const auditQuestionClass = css({ color: "zodiac.cream/66", mt: "1" });

export function EditorialPage() {
  onMount(() => {
    document.title = "Editorial — Frequency Music";
  });

  const artifacts = createQueryWithStatus(api.editorialArtifacts.list, () => ({
    limit: 50,
  }));
  const missingWhyThisMattersQuery = createQueryWithStatus(
    api.hypotheses.listMissingWhyThisMatters,
    () => ({
      limit: 20,
    }),
  );
  const missingWhyThisMatters = missingWhyThisMattersQuery.data;
  const exportForAstro = createAction(api.editorialArtifacts.exportForAstro);

  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
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
    // aria-busy/aria-disabled rather than `disabled`, so the button keeps
    // focus while the export runs; this guard stops a second activation.
    if (exporting() || publishedPublicCount() === 0) return;
    setExporting(true);
    setNotice(null);
    setNoticeError(null);
    try {
      const result = await exportForAstro();
      setNotice(
        `Exported ${result.exportedCount} public artifact(s) to ${result.manifestPath}.`,
      );
    } catch (error) {
      setNoticeError(`Export failed: ${describeError(error)}`);
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
                color: "zodiac.cream/66",
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
              <UIBadge tone="cream">{rows().length} artifacts</UIBadge>
              <UIBadge tone="gold">
                {publishedPublicCount()} ready for export
              </UIBadge>
            </div>
          </div>
          <UIButton
            variant="outline"
            onClick={handleExport}
            aria-busy={exporting()}
            aria-disabled={exporting() || publishedPublicCount() === 0}
          >
            {exporting() ? "Exporting..." : "Export public snapshot"}
          </UIButton>
        </div>
        <UINotice
          class={css({ mt: "3" })}
          status={notice()}
          error={noticeError()}
        />
      </UICard>

      <UINotice
        error={
          missingWhyThisMattersQuery.isError()
            ? `Unable to load the Phase 1 audit: ${missingWhyThisMattersQuery.error()?.message ?? "unknown error"}`
            : null
        }
      />

      <Show when={(missingWhyThisMatters() ?? []).length > 0}>
        <UICard>
          <h2 class={sectionTitleClass}>Phase 1 Audit</h2>
          <p class={css({ color: "zodiac.cream/66", mb: "3" })}>
            These hypotheses still have no <em>why this matters</em> copy and
            should be cleaned up before they feed public artifacts.
          </p>
          <UIList class={auditListClass}>
            <For each={missingWhyThisMatters() ?? []}>
              {(hypothesis) => (
                <li>
                  <Link
                    to="/hypotheses/$hypothesisId"
                    params={{ hypothesisId: String(hypothesis._id) }}
                    class={linkCardClass}
                  >
                    <div>{hypothesis.title}</div>
                    <div class={auditQuestionClass}>{hypothesis.question}</div>
                  </Link>
                </li>
              )}
            </For>
          </UIList>
        </UICard>
      </Show>

      <UICard>
        <h2 class={sectionTitleClass}>Artifacts</h2>
        <UINotice
          status={
            artifacts.isLoading()
              ? "Loading artifacts..."
              : !artifacts.isError() && rows().length === 0
                ? "No editorial artifacts yet. Create a recap from a weekly brief, thesis, or campaign."
                : null
          }
          error={
            artifacts.isError()
              ? `Unable to load editorial artifacts: ${artifacts.error()?.message ?? "unknown error"}`
              : null
          }
        />
        <Show when={!artifacts.isLoading()}>
          <Show when={rows().length > 0}>
            <UIList class={artifactListClass}>
              <For each={rows()}>
                {(artifact) => (
                  <li class={entityCardLinkClass}>
                    <div class={artifactBadgeRowClass}>
                      <UIBadge tone="gold">
                        {formatEditorialKind(artifact.kind)}
                      </UIBadge>
                      <UIBadge tone="cream">{artifact.status}</UIBadge>
                      <UIBadge tone="cream">{artifact.visibility}</UIBadge>
                      <UIBadge
                        tone={evidenceStatusTone(artifact.evidenceStatus)}
                      >
                        {artifact.evidenceStatus}
                      </UIBadge>
                      <UIBadge tone="cream">
                        {artifact.publicEvidenceCards.length} evidence cards
                      </UIBadge>
                    </div>
                    <h3 class={artifactTitleClass}>
                      <Link
                        to="/editorial/$artifactId"
                        params={{ artifactId: String(artifact._id) }}
                        class={entityCardTitleLinkClass}
                      >
                        {artifact.title}
                      </Link>
                    </h3>
                    <p class={mutedClass}>{artifact.dek}</p>
                  </li>
                )}
              </For>
            </UIList>
          </Show>
        </Show>
      </UICard>
    </section>
  );
}
