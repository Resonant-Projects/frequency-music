import { TargetAudio } from "../components/target-audio";
import { Link, useParams } from "@tanstack/solid-router";
import { createEffect, For, onMount, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import { entityCellClass } from "../components/entity-card";
import {
  backLink,
  badgeRowClass,
  collapsedNoticeClass,
  DateTime,
  detailTitleClass,
  goldDivider,
  Markdown,
  metaLine,
  pageClass,
  proseClass,
  sectionLabel,
  UIBadge,
  UICard,
  UIList,
  UINotice,
} from "../components/ui";
import { createQueryWithStatus, describeLoad } from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

const paramGrid = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    md: "repeat(2, minmax(0, 1fr))",
  },
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
});

const headerRowClass = cx(badgeRowClass, css({ mb: "2" }));

const createdClass = cx(metaLine, css({ ml: "auto" }));

const linkedHypothesisClass = css({
  color: "zodiac.violetText",
  fontFamily: "mono",
  fontSize: "xs",
  mt: "2",
});

const checklistList = css({
  listStylePosition: "outside",
  listStyleType: "decimal",
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
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    md: "repeat(2, minmax(0, 1fr))",
  },
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

  const recipeQuery = createQueryWithStatus(api.recipes.get, () => ({
    id: params().recipeId as Id<"recipes">,
  }));
  const recipe = recipeQuery.data;

  onMount(() => {
    document.title = "Recipe — Frequency Music";
  });

  createEffect(() => {
    const r = recipe();
    if (r) document.title = `${r.title} — Frequency Music`;
  });

  const load = describeLoad(recipeQuery, "recipe");

  return (
    <section class={pageClass}>
      <div>
        <Link to="/recipes" class={backLink}>
          <span aria-hidden="true">&larr;</span> Recipes
        </Link>
      </div>

      <UICard class={recipe() ? collapsedNoticeClass : undefined}>
        <UINotice status={load.status()} error={load.error()} />
      </UICard>

      <Show when={recipe()}>
        {(r) => (
          <UICard>
            <div class={headerRowClass}>
              <UIBadge tone="gold">{r().status}</UIBadge>
              <UIBadge tone="cream">{r().visibility}</UIBadge>
              <DateTime class={createdClass} value={r().createdAt} />
            </div>

            <h1 class={detailTitleClass}>{r().title}</h1>

            <TargetAudio target={{ kind: "recipe", id: r()._id }} />

            <Show when={r().hypothesis}>
              {(hyp) => (
                <p class={linkedHypothesisClass}>Hypothesis: {hyp().title}</p>
              )}
            </Show>

            <Show when={r().whyThisMatters}>
              {(value) => (
                <>
                  <hr class={goldDivider} />
                  <h2 class={sectionLabel}>Why This Matters</h2>
                  <p class={proseClass}>{value()}</p>
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
                    <div class={entityCellClass}>
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
                      <UIList>
                        <For each={proto().panelPlanned}>
                          {(member) => (
                            <li class={protocolListItem}>{member}</li>
                          )}
                        </For>
                      </UIList>
                    </Show>

                    <div class={protocolColumns}>
                      <div>
                        <h3 class={protocolColumnTitle}>What Varies</h3>
                        <UIList>
                          <For each={proto().whatVaries}>
                            {(item) => <li class={protocolListItem}>{item}</li>}
                          </For>
                        </UIList>
                      </div>
                      <div>
                        <h3 class={protocolColumnTitle}>What Stays Constant</h3>
                        <UIList>
                          <For each={proto().whatStaysConstant}>
                            {(item) => <li class={protocolListItem}>{item}</li>}
                          </For>
                        </UIList>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Show>
          </UICard>
        )}
      </Show>
    </section>
  );
}
