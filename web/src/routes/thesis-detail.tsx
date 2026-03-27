import { Link, useParams } from "@tanstack/solid-router";
import { createEffect, createSignal, For, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  UIBadge,
  UIButton,
  UICard,
  UISelect,
  backLink,
  detailTitleClass,
  goldDivider,
  pageClass,
  sectionLabel,
} from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import { createMutation, createQuery } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

const statGrid = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "repeat(2, minmax(0, 1fr))",
    md: "repeat(4, minmax(0, 1fr))",
  },
});

const statCard = css({
  bg: "rgba(245, 240, 232, 0.03)",
  borderColor: "rgba(200, 168, 75, 0.18)",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "3",
});

const linkList = css({
  display: "grid",
  gap: "2",
});

export function ThesisDetailPage() {
  const params = useParams({ from: "/theses/$thesisId" });
  const detail = createQuery(convexApi.theses.getDetail, () => ({
    id: params().thesisId as Id<"theses">,
  }));
  const campaigns = createQuery(convexApi.campaigns.listForSelection);
  const attachThesis = createMutation(convexApi.campaigns.attachThesis);
  const detachThesis = createMutation(convexApi.campaigns.detachThesis);
  const [selectedCampaignId, setSelectedCampaignId] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(null);

  createEffect(() => {
    const thesis = detail()?.thesis;
    if (thesis) document.title = `${thesis.title} — Frequency Music`;
  });

  async function handleAttach() {
    if (!selectedCampaignId()) {
      setNotice("Select a campaign first.");
      return;
    }
    try {
      await attachThesis(
        withDevBypassSecret({
          campaignId: selectedCampaignId() as Id<"campaigns">,
          thesisId: params().thesisId as Id<"theses">,
        }),
      );
      setNotice("Thesis attached to campaign.");
      setSelectedCampaignId("");
    } catch (error) {
      setNotice(`Attach failed: ${String(error)}`);
    }
  }

  async function handleDetach(campaignId: Id<"campaigns">) {
    try {
      await detachThesis(
        withDevBypassSecret({
          campaignId,
          thesisId: params().thesisId as Id<"theses">,
        }),
      );
      setNotice("Thesis detached from campaign.");
    } catch (error) {
      setNotice(`Detach failed: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <div>
        <Link to="/theses" class={backLink}>
          <span aria-hidden="true">&larr;</span> Theses
        </Link>
      </div>

      <Show
        when={detail()}
        fallback={
          <UICard>
            <p class={css({ color: "zodiac.cream" })}>Loading thesis...</p>
          </UICard>
        }
      >
        {(row) => (
          <>
            <UICard>
              <div
                class={css({
                  display: "flex",
                  gap: "2",
                  flexWrap: "wrap",
                  mb: "2",
                })}
              >
                <UIBadge tone="gold">{row().thesis.status}</UIBadge>
                <UIBadge tone="cream">{row().thesis.visibility}</UIBadge>
                <UIBadge tone="violet">
                  {row().hypotheses.length} hypotheses
                </UIBadge>
                <UIBadge tone="violet">{row().recipes.length} recipes</UIBadge>
                <UIBadge tone="violet">
                  {row().compositions.length} compositions
                </UIBadge>
              </div>

              <h1 class={detailTitleClass}>{row().thesis.title}</h1>
              <p
                class={css({
                  color: "rgba(245, 240, 232, 0.78)",
                  fontSize: "lg",
                  lineHeight: "1.7",
                })}
              >
                {row().thesis.statement}
              </p>

              <Show when={row().thesis.descriptionMd}>
                {(description) => (
                  <>
                    <hr class={goldDivider} />
                    <div class={sectionLabel}>Description</div>
                    <p
                      class={css({
                        color: "rgba(245, 240, 232, 0.7)",
                        lineHeight: "1.7",
                        whiteSpace: "pre-wrap",
                      })}
                    >
                      {description()}
                    </p>
                  </>
                )}
              </Show>

              <hr class={goldDivider} />
              <div class={sectionLabel}>Thesis Signals</div>
              <div class={statGrid}>
                <div class={statCard}>
                  <div class={css({ color: "zodiac.gold", fontSize: "2xl" })}>
                    {row().stats.contradictionCount}
                  </div>
                  <div
                    class={css({
                      color: "rgba(245, 240, 232, 0.58)",
                      fontSize: "sm",
                    })}
                  >
                    contradictions
                  </div>
                </div>
                <div class={statCard}>
                  <div class={css({ color: "zodiac.gold", fontSize: "2xl" })}>
                    {row().stats.activeCount}
                  </div>
                  <div
                    class={css({
                      color: "rgba(245, 240, 232, 0.58)",
                      fontSize: "sm",
                    })}
                  >
                    active
                  </div>
                </div>
                <div class={statCard}>
                  <div class={css({ color: "zodiac.gold", fontSize: "2xl" })}>
                    {row().stats.evaluatedCount}
                  </div>
                  <div
                    class={css({
                      color: "rgba(245, 240, 232, 0.58)",
                      fontSize: "sm",
                    })}
                  >
                    evaluated
                  </div>
                </div>
                <div class={statCard}>
                  <div class={css({ color: "zodiac.gold", fontSize: "2xl" })}>
                    {row().stats.retiredCount}
                  </div>
                  <div
                    class={css({
                      color: "rgba(245, 240, 232, 0.58)",
                      fontSize: "sm",
                    })}
                  >
                    retired
                  </div>
                </div>
              </div>

              <hr class={goldDivider} />
              <div class={sectionLabel}>Campaign Membership</div>
              <div class={css({ display: "grid", gap: "3" })}>
                <Show
                  when={row().campaigns.length > 0}
                  fallback={
                    <p class={css({ color: "rgba(245, 240, 232, 0.62)" })}>
                      This thesis is not attached to a campaign yet.
                    </p>
                  }
                >
                  <For each={row().campaigns}>
                    {(campaign) => (
                      <div
                        class={css({
                          alignItems: "center",
                          borderColor: "rgba(200, 168, 75, 0.18)",
                          borderRadius: "l2",
                          borderWidth: "1px",
                          display: "flex",
                          gap: "3",
                          justifyContent: "space-between",
                          p: "3",
                          flexWrap: "wrap",
                        })}
                      >
                        <div>
                          <div class={css({ color: "zodiac.cream", mb: "1" })}>
                            {campaign.title}
                          </div>
                          <div
                            class={css({
                              color: "rgba(245, 240, 232, 0.62)",
                              fontSize: "sm",
                            })}
                          >
                            {campaign.question}
                          </div>
                        </div>
                        <div class={css({ display: "flex", gap: "2", flexWrap: "wrap" })}>
                          <UIBadge tone="gold">{campaign.status}</UIBadge>
                          <UIButton
                            variant="outline"
                            onClick={() => handleDetach(campaign._id)}
                          >
                            Detach
                          </UIButton>
                        </div>
                      </div>
                    )}
                  </For>
                </Show>

                <div>
                  <label class={css({ color: "rgba(245, 240, 232, 0.68)", display: "block", mb: "2" })}>
                    Attach To Campaign
                  </label>
                  <div class={css({ display: "flex", gap: "2", flexWrap: "wrap" })}>
                    <UISelect
                      data-testid="thesis-campaign-select"
                      value={selectedCampaignId()}
                      onChange={(event) => setSelectedCampaignId(event.currentTarget.value)}
                    >
                      <option value="">Select campaign</option>
                      <For each={((campaigns() ?? []) as Doc<"campaigns">[]).filter(
                        (campaign: Doc<"campaigns">) =>
                          !row()
                            .campaigns.map((linked: Doc<"campaigns">) => linked._id)
                            .includes(campaign._id),
                      )}>
                        {(campaign) => (
                          <option value={String(campaign._id)}>
                            {campaign.title}
                          </option>
                        )}
                      </For>
                    </UISelect>
                    <UIButton variant="outline" onClick={handleAttach}>
                      Attach
                    </UIButton>
                  </div>
                </div>

                <Show when={notice()}>
                  {(message) => (
                    <p class={css({ color: "zodiac.cream" })}>{message()}</p>
                  )}
                </Show>
              </div>

              <hr class={goldDivider} />
              <div class={sectionLabel}>Hypotheses</div>
              <div class={linkList}>
                <For each={row().hypotheses}>
                  {(hypothesis) => (
                    <Link
                      to="/hypotheses/$hypothesisId"
                      params={{ hypothesisId: String(hypothesis._id) }}
                      class={css({
                        color: "rgba(245, 240, 232, 0.78)",
                        textDecoration: "none",
                      })}
                    >
                      {hypothesis.title}
                    </Link>
                  )}
                </For>
              </div>

              <Show when={row().recipes.length > 0}>
                <hr class={goldDivider} />
                <div class={sectionLabel}>Recipes</div>
                <div class={linkList}>
                  <For each={row().recipes}>
                    {(recipe) => (
                      <Link
                        to="/recipes/$recipeId"
                        params={{ recipeId: String(recipe._id) }}
                        class={css({
                          color: "rgba(245, 240, 232, 0.78)",
                          textDecoration: "none",
                        })}
                      >
                        {recipe.title}
                      </Link>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={row().compositions.length > 0}>
                <hr class={goldDivider} />
                <div class={sectionLabel}>Compositions</div>
                <div class={linkList}>
                  <For each={row().compositions}>
                    {(composition) => (
                      <Link
                        to="/compositions/$compositionId"
                        params={{ compositionId: String(composition._id) }}
                        class={css({
                          color: "rgba(245, 240, 232, 0.78)",
                          textDecoration: "none",
                        })}
                      >
                        {composition.title}
                      </Link>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={row().recentWeeklyBriefIds.length > 0}>
                <hr class={goldDivider} />
                <div class={sectionLabel}>Recent Weekly Briefs</div>
                <div class={linkList}>
                  <For each={row().recentWeeklyBriefIds}>
                    {(briefId) => (
                      <Link
                        to="/weekly-turns/$briefId"
                        params={{ briefId: String(briefId) }}
                        class={css({
                          color: "rgba(245, 240, 232, 0.78)",
                          textDecoration: "none",
                        })}
                      >
                        Weekly brief {String(briefId).slice(-6)}
                      </Link>
                    )}
                  </For>
                </div>
              </Show>
            </UICard>
          </>
        )}
      </Show>
    </section>
  );
}
