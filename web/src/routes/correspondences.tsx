import { Link } from "@tanstack/solid-router";
import { createUniqueId, For, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import { css } from "../../styled-system/css";
import {
  UIBadge,
  UICard,
  UINotice,
  metaLine,
  pageClass,
  pageTitleClass,
  sectionLabel,
} from "../components/ui";
import { createQueryWithStatus } from "../integrations/convex";

const LIST_LIMIT = 25;

const STATUS_SECTIONS = [
  {
    status: "conjectured",
    description:
      "Unresolved correspondences waiting for evidence or experiment.",
  },
  {
    status: "evidenced",
    description: "Correspondences whose supporting evidence currently leads.",
  },
  {
    status: "contradicted",
    description:
      "Correspondences whose contradicting evidence currently leads.",
  },
  {
    status: "retired",
    description:
      "Correspondences deliberately removed from active consideration.",
  },
] as const;

const rowLinkClass = css({
  borderColor: "zodiac.violet/22",
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
    bg: "zodiac.violet/8",
    borderColor: "zodiac.violet/48",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "zodiac.violet",
    outlineOffset: "2px",
  },
});

const updatedAtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatUpdatedAt(value: number) {
  return updatedAtFormatter.format(new Date(value));
}

export function CorrespondencesPage() {
  const sections = STATUS_SECTIONS.map((section) => ({
    ...section,
    query: createQueryWithStatus(api.correspondences.listByStatus, () => ({
      status: section.status,
      limit: LIST_LIMIT,
    })),
  }));

  return (
    <section class={pageClass}>
      <UICard>
        <UIBadge tone="violet">Adjudication</UIBadge>
        <h1 class={pageTitleClass}>Correspondences</h1>
        <p class={css({ color: "zodiac.cream/70", maxW: "72ch" })}>
          Review the current lifecycle state and evidence for cross-domain
          correspondences. This surface decides existing work; it does not
          author conjectures or evidence.
        </p>
      </UICard>

      <For each={sections}>
        {(section) => {
          const headingId = createUniqueId();
          const sectionStatus = () => {
            if (section.query.isLoading()) {
              return `Loading ${section.status} correspondences…`;
            }
            if (section.query.isError()) return null;
            if ((section.query.data() ?? []).length > 0) return null;
            return `No ${section.status} correspondences in the latest bounded window.`;
          };
          const sectionError = () =>
            section.query.isError()
              ? `Unable to load ${section.status} correspondences: ${section.query.error()?.message ?? "Unknown error"}`
              : null;

          return (
            <UICard aria-labelledby={headingId}>
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
                <h2 class={sectionLabel} id={headingId}>
                  {section.status}
                </h2>
                <Show when={section.query.data()}>
                  {(rows) => (
                    <UIBadge tone="violet">{rows().length} shown</UIBadge>
                  )}
                </Show>
              </div>
              <p class={css({ color: "zodiac.cream/62", mb: "3" })}>
                {section.description}
              </p>

              <UINotice status={sectionStatus()} error={sectionError()} />
              <Show
                when={
                  !section.query.isLoading() &&
                  !section.query.isError() &&
                  (section.query.data() ?? []).length > 0
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
            </UICard>
          );
        }}
      </For>
    </section>
  );
}
