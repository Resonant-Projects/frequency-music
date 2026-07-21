import { Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import { css } from "../../styled-system/css";
import {
  UIBadge,
  UICard,
  metaLine,
  pageClass,
  pageTitleClass,
  sectionLabel,
} from "../components/ui";
import { createQueryWithStatus } from "../integrations/convex";

const LIST_LIMIT = 25;

const rowLinkClass = css({
  borderColor: "rgba(139, 92, 246, 0.22)",
  borderRadius: "l2",
  borderWidth: "1px",
  color: "inherit",
  display: "grid",
  gap: "2",
  p: "3",
  textDecoration: "none",
  transitionDuration: "normal",
  transitionProperty: "background-color, border-color",
  _hover: {
    bg: "rgba(139, 92, 246, 0.08)",
    borderColor: "rgba(139, 92, 246, 0.48)",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "zodiac.violet",
    outlineOffset: "2px",
  },
});

function formatUpdatedAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CorrespondencesPage() {
  const conjectured = createQueryWithStatus(
    api.correspondences.listByStatus,
    () => ({ status: "conjectured" as const, limit: LIST_LIMIT }),
  );
  const evidenced = createQueryWithStatus(
    api.correspondences.listByStatus,
    () => ({
      status: "evidenced" as const,
      limit: LIST_LIMIT,
    }),
  );
  const contradicted = createQueryWithStatus(
    api.correspondences.listByStatus,
    () => ({ status: "contradicted" as const, limit: LIST_LIMIT }),
  );
  const retired = createQueryWithStatus(
    api.correspondences.listByStatus,
    () => ({
      status: "retired" as const,
      limit: LIST_LIMIT,
    }),
  );

  const sections = [
    {
      status: "conjectured",
      description:
        "Unresolved correspondences waiting for evidence or experiment.",
      query: conjectured,
    },
    {
      status: "evidenced",
      description: "Correspondences whose supporting evidence currently leads.",
      query: evidenced,
    },
    {
      status: "contradicted",
      description:
        "Correspondences whose contradicting evidence currently leads.",
      query: contradicted,
    },
    {
      status: "retired",
      description:
        "Correspondences deliberately removed from active consideration.",
      query: retired,
    },
  ] as const;

  return (
    <section class={pageClass}>
      <UICard>
        <UIBadge tone="violet">Adjudication</UIBadge>
        <h1 class={pageTitleClass}>Correspondences</h1>
        <p class={css({ color: "rgba(245, 240, 232, 0.7)", maxW: "72ch" })}>
          Review the current lifecycle state and evidence for cross-domain
          correspondences. This surface decides existing work; it does not
          author conjectures or evidence.
        </p>
      </UICard>

      <For each={sections}>
        {(section) => (
          <UICard>
            <div
              class={css({
                alignItems: "baseline",
                display: "flex",
                flexWrap: "wrap",
                gap: "2",
                justifyContent: "space-between",
                mb: "2",
              })}
            >
              <div class={sectionLabel}>{section.status}</div>
              <Show when={section.query.data()}>
                {(rows) => (
                  <UIBadge tone="violet">{rows().length} shown</UIBadge>
                )}
              </Show>
            </div>
            <p class={css({ color: "rgba(245, 240, 232, 0.62)", mb: "3" })}>
              {section.description}
            </p>

            <Show
              when={!section.query.isLoading()}
              fallback={<p>Loading {section.status} correspondences…</p>}
            >
              <Show
                when={!section.query.isError()}
                fallback={
                  <p class={css({ color: "zodiac.error" })}>
                    Unable to load {section.status} correspondences:{" "}
                    {section.query.error()?.message ?? "Unknown error"}
                  </p>
                }
              >
                <Show
                  when={(section.query.data() ?? []).length > 0}
                  fallback={
                    <p class={css({ color: "rgba(245, 240, 232, 0.56)" })}>
                      No {section.status} correspondences in the latest bounded
                      window.
                    </p>
                  }
                >
                  <div class={css({ display: "grid", gap: "2" })}>
                    <For each={section.query.data() ?? []}>
                      {(row) => (
                        <Link
                          to="/correspondences/$correspondenceId"
                          params={{ correspondenceId: String(row._id) }}
                          class={rowLinkClass}
                        >
                          <span
                            class={css({
                              color: "zodiac.cream",
                              fontFamily: "display",
                              fontSize: "lg",
                              lineHeight: "1.35",
                            })}
                          >
                            {row.statement}
                          </span>
                          <span class={metaLine}>
                            {row.evidence.length} evidence · updated{" "}
                            {formatUpdatedAt(row.updatedAt)}
                          </span>
                        </Link>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </Show>
          </UICard>
        )}
      </For>
    </section>
  );
}
