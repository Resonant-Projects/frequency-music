import { Link, useParams } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  UIBadge,
  UICard,
  backLink,
  detailTitleClass,
  goldDivider,
  metaLine,
  pageClass,
  sectionLabel,
} from "../components/ui";
import { createQuery } from "../integrations/convex";

export function CorrespondenceDetailPage() {
  const params = useParams({ from: "/correspondences/$correspondenceId" });
  const correspondence = createQuery(api.correspondences.get, () => ({
    id: params().correspondenceId as Id<"correspondences">,
  }));

  return (
    <section class={pageClass}>
      <div>
        <Link to="/weekly-turns" class={backLink}>
          <span aria-hidden="true">&larr;</span> Weekly Briefs
        </Link>
      </div>
      <Show
        when={correspondence()}
        fallback={
          <UICard>
            <p class={css({ color: "zodiac.cream" })}>
              Loading correspondence...
            </p>
          </UICard>
        }
      >
        {(row) => (
          <UICard>
            <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
              <UIBadge tone="gold">Correspondence</UIBadge>
              <UIBadge tone="cream">{row().status}</UIBadge>
              <UIBadge tone="violet">{row().evidence.length} evidence</UIBadge>
            </div>
            <h1 class={detailTitleClass}>{row().statement}</h1>
            <p class={metaLine}>pair: {row().pairKey}</p>

            <hr class={goldDivider} />
            <div class={sectionLabel}>Rationale</div>
            <p
              class={css({
                color: "rgba(245, 240, 232, 0.76)",
                fontSize: "lg",
                lineHeight: "1.65",
                maxWidth: "72ch",
              })}
            >
              {row().rationaleMd}
            </p>

            <Show when={row().statusReason}>
              {(reason) => (
                <>
                  <hr class={goldDivider} />
                  <div class={sectionLabel}>Status reason</div>
                  <p class={css({ color: "rgba(245, 240, 232, 0.76)" })}>
                    {reason()}
                  </p>
                </>
              )}
            </Show>

            <Show when={row().evidence.length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Evidence</div>
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={row().evidence}>
                  {(citation) => (
                    <div
                      class={css({
                        borderBottom: "1px solid rgba(200, 168, 75, 0.16)",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "2",
                        justifyContent: "space-between",
                        py: "2",
                      })}
                    >
                      <span>{citation.note ?? String(citation.claimId)}</span>
                      <span class={metaLine}>
                        {citation.stance} · {citation.addedBy}
                      </span>
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
