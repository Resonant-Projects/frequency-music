import { Link, useParams } from "@tanstack/solid-router";
import { createEffect, For, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  backLink,
  collapsedNoticeClass,
  detailTitleClass,
  goldDivider,
  Markdown,
  pageClass,
  sectionLabel,
  UIBadge,
  UICard,
  UINotice,
} from "../components/ui";
import { createQuery } from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

const paramGrid = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
});

const paramCell = css({
  borderColor: "zodiac.gold/18",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "3",
});

const paramType = css({
  color: "zodiac.gold",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  mb: "1",
  textTransform: "uppercase",
});

const paramValue = css({
  color: "zodiac.cream",
  fontFamily: "mono",
  fontSize: "sm",
  overflowWrap: "anywhere",
});

const checklistList = css({
  listStylePosition: "outside",
  listStyleType: "decimal",
  margin: 0,
  pl: "6",
});

const checklistItem = css({
  color: "zodiac.cream/82",
  display: "list-item",
  fontFamily: "mono",
  fontSize: "sm",
  py: "1.5",
  "&::marker": {
    color: "zodiac.gold",
    fontSize: "xs",
  },
});

const protocolPanel = css({
  bg: "zodiac.gold/4",
  borderColor: "zodiac.gold/18",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "5",
});

const protocolMeta = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "2",
  mb: "4",
});

const protocolColumns = css({
  display: "grid",
  gap: "4",
  gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
  mt: "4",
});

const protocolColumnTitle = css({
  color: "zodiac.gold",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  mb: "2",
  textTransform: "uppercase",
});

const protocolList = css({
  listStyleType: "none",
  margin: 0,
  padding: 0,
});

const protocolListItem = css({
  color: "zodiac.cream/78",
  fontFamily: "mono",
  fontSize: "sm",
  py: "0.5",
});

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  if (mins < 60) return rem ? `${mins}m ${rem}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

export function RecipeDetailPage() {
  const params = useParams({ from: "/recipes/$recipeId" });

  const recipe = createQuery(api.recipes.get, () => ({
    id: params().recipeId as Id<"recipes">,
  }));

  createEffect(() => {
    const r = recipe();
    if (r) document.title = `${r.title} — Frequency Music`;
  });

  return (
    <section class={pageClass}>
      <div>
        <Link to="/recipes" class={backLink}>
          <span aria-hidden="true">&larr;</span> Recipes
        </Link>
      </div>

      <UINotice
        class={recipe() ? collapsedNoticeClass : undefined}
        status={recipe() ? null : "Loading recipe..."}
      />

      <Show when={recipe()}>
        {(r) => (
          <>
            {/* Header */}
            <UICard>
              <div
                class={css({
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "2",
                  mb: "2",
                })}
              >
                <UIBadge tone="gold">{r().status}</UIBadge>
                <UIBadge tone="cream">{r().visibility}</UIBadge>
                <span
                  class={css({
                    color: "zodiac.cream/66",
                    fontFamily: "mono",
                    fontSize: "xs",
                    ml: "auto",
                  })}
                >
                  {new Date(r().createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>

              <h1 class={detailTitleClass}>{r().title}</h1>

              <Show when={r().hypothesis}>
                {(hyp) => (
                  <p
                    class={css({
                      color: "zodiac.violetText",
                      fontFamily: "mono",
                      fontSize: "xs",
                      mt: "2",
                    })}
                  >
                    Hypothesis: {hyp().title}
                  </p>
                )}
              </Show>

              <Show when={r().whyThisMatters}>
                {(value) => (
                  <>
                    <hr class={goldDivider} />
                    <h2 class={sectionLabel}>Why This Matters</h2>
                    <p
                      class={css({
                        color: "zodiac.cream/74",
                        fontFamily: "display",
                        fontSize: "md",
                        lineHeight: "1.7",
                      })}
                    >
                      {value()}
                    </p>
                  </>
                )}
              </Show>

              {/* Body */}
              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Body</h2>
              <Markdown content={r().bodyMd} />

              {/* Parameters */}
              <Show when={r().parameters.length > 0}>
                <hr class={goldDivider} />
                <h2 class={sectionLabel}>Parameters</h2>
                <div class={paramGrid}>
                  <For each={r().parameters}>
                    {(param) => (
                      <div class={paramCell}>
                        <div class={paramType}>
                          {param.kind ?? param.type ?? "parameter"}
                        </div>
                        <div class={paramValue}>{param.value}</div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              {/* DAW Checklist */}
              <Show when={r().dawChecklist.length > 0}>
                <hr class={goldDivider} />
                <h2 class={sectionLabel}>DAW Checklist</h2>
                <ol class={checklistList}>
                  <For each={r().dawChecklist}>
                    {(step) => <li class={checklistItem}>{step}</li>}
                  </For>
                </ol>
              </Show>

              {/* Protocol */}
              <Show when={r().protocol}>
                {(proto) => (
                  <>
                    <hr class={goldDivider} />
                    <h2 class={sectionLabel}>Protocol</h2>
                    <div class={protocolPanel}>
                      <div class={protocolMeta}>
                        <UIBadge tone="gold">{proto().studyType}</UIBadge>
                        <UIBadge tone="cream">
                          {formatDuration(proto().durationSecs)}
                        </UIBadge>
                        <Show when={proto().listeningContext}>
                          {(ctx) => <UIBadge tone="violet">{ctx()}</UIBadge>}
                        </Show>
                        <Show when={proto().listeningMethod}>
                          {(method) => (
                            <UIBadge tone="violet">{method()}</UIBadge>
                          )}
                        </Show>
                      </div>

                      <Show when={proto().panelPlanned.length > 0}>
                        <h3 class={protocolColumnTitle}>Panel Planned</h3>
                        <ul class={protocolList}>
                          <For each={proto().panelPlanned}>
                            {(member) => (
                              <li class={protocolListItem}>{member}</li>
                            )}
                          </For>
                        </ul>
                      </Show>

                      <div class={protocolColumns}>
                        <div>
                          <h3 class={protocolColumnTitle}>What Varies</h3>
                          <ul class={protocolList}>
                            <For each={proto().whatVaries}>
                              {(item) => (
                                <li class={protocolListItem}>{item}</li>
                              )}
                            </For>
                          </ul>
                        </div>
                        <div>
                          <h3 class={protocolColumnTitle}>
                            What Stays Constant
                          </h3>
                          <ul class={protocolList}>
                            <For each={proto().whatStaysConstant}>
                              {(item) => (
                                <li class={protocolListItem}>{item}</li>
                              )}
                            </For>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </Show>
            </UICard>
          </>
        )}
      </Show>
    </section>
  );
}
