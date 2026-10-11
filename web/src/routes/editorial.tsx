import { Link } from "@tanstack/solid-router";
import {
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onMount,
  Show,
} from "solid-js";
import type { Doc } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import {
  focusRingClass,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
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

const auditLinkClass = cx(
  focusRingClass,
  css({
    borderColor: "zodiac.gold/18",
    borderRadius: "l2",
    borderWidth: "1px",
    color: "inherit",
    display: "block",
    p: "3",
    textDecoration: "none",
    transition: "border-color 0.2s ease",
    _hover: { borderColor: "zodiac.gold/45" },
  }),
);

const artifactCardClass = css({
  position: "relative",
  borderColor: "zodiac.gold/22",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "4",
  transition: "border-color 0.2s ease",
  _hover: { borderColor: "zodiac.gold/45" },
});

// Covers the whole card so it stays one click target, while the heading sits
// outside the anchor and names it through aria-labelledby.
const stretchedLinkClass = cx(
  focusRingClass,
  css({
    position: "absolute",
    inset: "0",
    zIndex: "1",
    borderRadius: "l2",
  }),
);

const plainListClass = css({
  display: "grid",
  listStyle: "none",
  m: "0",
  p: "0",
});

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
          <ul role="list" class={cx(plainListClass, css({ gap: "2" }))}>
            <For each={missingWhyThisMatters() ?? []}>
              {(hypothesis) => (
                <li>
                  <Link
                    to="/hypotheses/$hypothesisId"
                    params={{ hypothesisId: String(hypothesis._id) }}
                    class={auditLinkClass}
                  >
                    <div class={css({ color: "zodiac.cream" })}>
                      {hypothesis.title}
                    </div>
                    <div class={css({ color: "zodiac.cream/66", mt: "1" })}>
                      {hypothesis.question}
                    </div>
                  </Link>
                </li>
              )}
            </For>
          </ul>
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
            <ul role="list" class={cx(plainListClass, css({ gap: "3" }))}>
              <For each={rows()}>
                {(artifact) => {
                  const titleId = createUniqueId();
                  return (
                    <li class={artifactCardClass}>
                      <div
                        class={css({
                          display: "flex",
                          gap: "2",
                          flexWrap: "wrap",
                          mb: "2",
                        })}
                      >
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
                      <h3
                        id={titleId}
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
                      <p class={css({ color: "zodiac.cream/66" })}>
                        {artifact.dek}
                      </p>
                      <Link
                        to="/editorial/$artifactId"
                        params={{ artifactId: String(artifact._id) }}
                        aria-labelledby={titleId}
                        class={stretchedLinkClass}
                      />
                    </li>
                  );
                }}
              </For>
            </ul>
          </Show>
        </Show>
      </UICard>
    </section>
  );
}
