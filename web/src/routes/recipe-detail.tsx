import { Link, useParams } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import { Markdown, UIBadge, UICard, pageClass } from "../components/ui";
import { createQuery } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

const goldDivider = css({
  border: "none",
  borderTop: "1px solid rgba(200, 168, 75, 0.22)",
  my: "6",
});

const backLink = css({
  color: "zodiac.gold",
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "mono",
  fontSize: "xs",
  gap: "1.5",
  letterSpacing: "0.14em",
  textDecoration: "none",
  textTransform: "uppercase",
  opacity: 0.7,
  _hover: { opacity: 1 },
});

const titleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "2xl", md: "3xl" },
  fontWeight: "normal",
  lineHeight: "1.3",
  mt: "3",
});

const sectionLabel = css({
  color: "zodiac.gold",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  mb: "3",
  textTransform: "uppercase",
});

const paramGrid = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
});

const paramCell = css({
  borderColor: "rgba(200, 168, 75, 0.18)",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "3",
});

const paramType = css({
  color: "zodiac.gold",
  fontFamily: "mono",
  fontSize: "2xs",
  letterSpacing: "0.14em",
  mb: "1",
  textTransform: "uppercase",
});

const paramValue = css({
  color: "zodiac.cream",
  fontFamily: "mono",
  fontSize: "sm",
});

const checklistItem = css({
  alignItems: "baseline",
  color: "rgba(245, 240, 232, 0.82)",
  display: "flex",
  fontFamily: "mono",
  fontSize: "sm",
  gap: "3",
  py: "1.5",
});

const checklistNumber = css({
  color: "zodiac.gold",
  fontFamily: "mono",
  fontSize: "xs",
  minW: "5",
  textAlign: "right",
});

const protocolPanel = css({
  bg: "rgba(200, 168, 75, 0.04)",
  borderColor: "rgba(200, 168, 75, 0.18)",
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
  fontSize: "2xs",
  letterSpacing: "0.14em",
  mb: "2",
  textTransform: "uppercase",
});

const protocolListItem = css({
  color: "rgba(245, 240, 232, 0.78)",
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

  const recipe = createQuery(convexApi.recipes.get, () => ({
    id: params().recipeId as Id<"recipes">,
  }));

  return (
    <section class={pageClass}>
      <div>
        <Link to="/recipes" class={backLink}>
          <span aria-hidden="true">&larr;</span> Recipes
        </Link>
      </div>

      <Show
        when={recipe()}
        fallback={
          <UICard>
            <p class={css({ color: "zodiac.cream" })}>Loading recipe...</p>
          </UICard>
        }
      >
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
                    color: "rgba(245, 240, 232, 0.45)",
                    fontFamily: "mono",
                    fontSize: "2xs",
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

              <h1 class={titleClass}>{r().title}</h1>

              <Show when={r().hypothesis}>
                {(hyp) => (
                  <p
                    class={css({
                      color: "rgba(139, 92, 246, 0.8)",
                      fontFamily: "mono",
                      fontSize: "xs",
                      mt: "2",
                    })}
                  >
                    Hypothesis: {hyp().title}
                  </p>
                )}
              </Show>

              {/* Body */}
              <hr class={goldDivider} />
              <div class={sectionLabel}>Body</div>
              <Markdown content={r().bodyMd} />

              {/* Parameters */}
              <Show when={r().parameters.length > 0}>
                <hr class={goldDivider} />
                <div class={sectionLabel}>Parameters</div>
                <div class={paramGrid}>
                  <For each={r().parameters}>
                    {(param) => (
                      <div class={paramCell}>
                        <div class={paramType}>{param.type}</div>
                        <div class={paramValue}>{param.value}</div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              {/* DAW Checklist */}
              <Show when={r().dawChecklist.length > 0}>
                <hr class={goldDivider} />
                <div class={sectionLabel}>DAW Checklist</div>
                <div>
                  <For each={r().dawChecklist}>
                    {(step, i) => (
                      <div class={checklistItem}>
                        <span class={checklistNumber}>{i() + 1}.</span>
                        <span>{step}</span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              {/* Protocol */}
              <Show when={r().protocol}>
                {(proto) => (
                  <>
                    <hr class={goldDivider} />
                    <div class={sectionLabel}>Protocol</div>
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
                        <div class={protocolColumnTitle}>Panel Planned</div>
                        <For each={proto().panelPlanned}>
                          {(member) => (
                            <div class={protocolListItem}>{member}</div>
                          )}
                        </For>
                      </Show>

                      <div class={protocolColumns}>
                        <div>
                          <div class={protocolColumnTitle}>What Varies</div>
                          <For each={proto().whatVaries}>
                            {(item) => (
                              <div class={protocolListItem}>{item}</div>
                            )}
                          </For>
                        </div>
                        <div>
                          <div class={protocolColumnTitle}>
                            What Stays Constant
                          </div>
                          <For each={proto().whatStaysConstant}>
                            {(item) => (
                              <div class={protocolListItem}>{item}</div>
                            )}
                          </For>
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
