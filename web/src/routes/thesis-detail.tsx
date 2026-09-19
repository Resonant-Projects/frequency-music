import { Link, useNavigate, useParams } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  backLink,
  collapsedNoticeClass,
  detailTitleClass,
  goldDivider,
  pageClass,
  sectionLabel,
  UIBadge,
  UIButton,
  UICard,
  UINotice,
  UISelect,
} from "../components/ui";
import { createMutation, createQuery } from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

const statGrid = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "repeat(2, minmax(0, 1fr))",
    md: "repeat(4, minmax(0, 1fr))",
  },
});

const statCard = css({
  bg: "zodiac.cream/3",
  borderColor: "zodiac.gold/18",
  borderRadius: "l2",
  borderWidth: "1px",
  // Value reads above its label while the <dt> still precedes the <dd>.
  display: "flex",
  flexDirection: "column-reverse",
  p: "3",
});

const statValue = css({
  color: "zodiac.gold",
  fontSize: "2xl",
  margin: 0,
});

const statLabel = css({
  color: "zodiac.cream/58",
  fontSize: "sm",
});

const linkList = css({
  display: "grid",
  gap: "2",
});

export function ThesisDetailPage() {
  const params = useParams({ from: "/theses/$thesisId" });
  const navigate = useNavigate();
  const detail = createQuery(api.theses.getDetail, () => ({
    id: params().thesisId as Id<"theses">,
  }));
  const campaigns = createQuery(api.campaigns.listForSelection);
  const attachThesis = createMutation(api.campaigns.attachThesis);
  const detachThesis = createMutation(api.campaigns.detachThesis);
  const createDraftFromThesis = createMutation(
    api.editorialArtifacts.createDraftFromThesis,
  );
  const [selectedCampaignId, setSelectedCampaignId] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  const [campaignError, setCampaignError] = createSignal<string | null>(null);
  const [creatingSummary, setCreatingSummary] = createSignal(false);
  const [creatingChangedMind, setCreatingChangedMind] = createSignal(false);
  const contradictedHypotheses = createMemo(
    () =>
      detail()?.hypotheses.filter(
        (hypothesis: Doc<"hypotheses">) =>
          hypothesis.resolution === "contradicted",
      ) ?? [],
  );
  const attachableCampaigns = createMemo(() => {
    const linkedIds = new Set(
      (detail()?.campaigns ?? []).map((linked: Doc<"campaigns">) => linked._id),
    );
    return ((campaigns() ?? []) as Doc<"campaigns">[]).filter(
      (campaign) => !linkedIds.has(campaign._id),
    );
  });

  createEffect(() => {
    const thesis = detail()?.thesis;
    if (thesis) document.title = `${thesis.title} — Frequency Music`;
  });

  function focusCampaignSelect() {
    const element = document.getElementById("thesis-campaign-select");
    if (element instanceof HTMLSelectElement) element.focus();
  }

  async function handleAttach() {
    if (!selectedCampaignId()) {
      setNotice(null);
      setNoticeError(null);
      setCampaignError("Select a campaign first.");
      focusCampaignSelect();
      return;
    }
    setNotice(null);
    setNoticeError(null);
    setCampaignError(null);
    try {
      await attachThesis({
        campaignId: selectedCampaignId() as Id<"campaigns">,
        thesisId: params().thesisId as Id<"theses">,
      });
      setNotice("Thesis attached to campaign.");
      setSelectedCampaignId("");
    } catch (error) {
      setNoticeError(`Attach failed: ${String(error)}`);
    }
  }

  async function handleDetach(campaignId: Id<"campaigns">) {
    setNotice(null);
    setNoticeError(null);
    try {
      await detachThesis({
        campaignId,
        thesisId: params().thesisId as Id<"theses">,
      });
      setNotice("Thesis detached from campaign.");
    } catch (error) {
      setNoticeError(`Detach failed: ${String(error)}`);
    }
  }

  async function handleCreateSummary() {
    setCreatingSummary(true);
    setNotice(null);
    setNoticeError(null);
    try {
      const artifactId = await createDraftFromThesis({
        thesisId: params().thesisId as Id<"theses">,
        kind: "thesis_summary",
      });
      void navigate({
        to: "/editorial/$artifactId",
        params: { artifactId: String(artifactId) },
      });
    } catch (error) {
      setNoticeError(`Summary draft failed: ${String(error)}`);
    } finally {
      setCreatingSummary(false);
    }
  }

  async function handleCreateChangedMind(hypothesisId: Id<"hypotheses">) {
    setCreatingChangedMind(true);
    setNotice(null);
    setNoticeError(null);
    try {
      const artifactId = await createDraftFromThesis({
        thesisId: params().thesisId as Id<"theses">,
        kind: "what_changed_my_mind",
        hypothesisId,
      });
      void navigate({
        to: "/editorial/$artifactId",
        params: { artifactId: String(artifactId) },
      });
    } catch (error) {
      setNoticeError(`Changed-mind draft failed: ${String(error)}`);
    } finally {
      setCreatingChangedMind(false);
    }
  }

  return (
    <section class={pageClass}>
      <div>
        <Link to="/theses" class={backLink}>
          <span aria-hidden="true">&larr;</span> Theses
        </Link>
      </div>

      <UINotice
        class={detail() ? collapsedNoticeClass : undefined}
        status={detail() ? null : "Loading thesis..."}
      />

      <Show when={detail()}>
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
                  color: "zodiac.cream/78",
                  fontSize: "lg",
                  lineHeight: "1.7",
                })}
              >
                {row().thesis.statement}
              </p>

              <div
                class={css({
                  display: "flex",
                  gap: "2",
                  flexWrap: "wrap",
                  mt: "3",
                })}
              >
                <UIButton
                  variant="outline"
                  onClick={handleCreateSummary}
                  disabled={creatingSummary()}
                >
                  {creatingSummary()
                    ? "Creating summary..."
                    : "Create thesis summary"}
                </UIButton>
                <For each={contradictedHypotheses()}>
                  {(hypothesis) => (
                    <UIButton
                      variant="outline"
                      onClick={() => handleCreateChangedMind(hypothesis._id)}
                      disabled={creatingChangedMind()}
                    >
                      {creatingChangedMind()
                        ? "Creating changed-mind draft..."
                        : `Create changed-mind draft for ${hypothesis.title}`}
                    </UIButton>
                  )}
                </For>
              </div>

              <Show when={row().thesis.descriptionMd}>
                {(description) => (
                  <>
                    <hr class={goldDivider} />
                    <h2 class={sectionLabel}>Description</h2>
                    <p
                      class={css({
                        color: "zodiac.cream/70",
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
              <h2 class={sectionLabel}>Thesis Signals</h2>
              <dl class={statGrid}>
                <div class={statCard}>
                  <dt class={statLabel}>contradictions</dt>
                  <dd class={statValue}>{row().stats.contradictionCount}</dd>
                </div>
                <div class={statCard}>
                  <dt class={statLabel}>active</dt>
                  <dd class={statValue}>{row().stats.activeCount}</dd>
                </div>
                <div class={statCard}>
                  <dt class={statLabel}>evaluated</dt>
                  <dd class={statValue}>{row().stats.evaluatedCount}</dd>
                </div>
                <div class={statCard}>
                  <dt class={statLabel}>retired</dt>
                  <dd class={statValue}>{row().stats.retiredCount}</dd>
                </div>
              </dl>

              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Campaign Membership</h2>
              <div class={css({ display: "grid", gap: "3" })}>
                <Show
                  when={row().campaigns.length > 0}
                  fallback={
                    <p class={css({ color: "zodiac.cream/62" })}>
                      This thesis is not attached to a campaign yet.
                    </p>
                  }
                >
                  <For each={row().campaigns}>
                    {(campaign) => (
                      <div
                        class={css({
                          alignItems: "center",
                          borderColor: "zodiac.gold/18",
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
                              color: "zodiac.cream/62",
                              fontSize: "sm",
                            })}
                          >
                            {campaign.question}
                          </div>
                        </div>
                        <div
                          class={css({
                            display: "flex",
                            gap: "2",
                            flexWrap: "wrap",
                          })}
                        >
                          <UIBadge tone="gold">{campaign.status}</UIBadge>
                          <UIButton
                            variant="outline"
                            aria-label={`Detach ${campaign.title}`}
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
                  <label
                    for="thesis-campaign-select"
                    class={css({
                      color: "zodiac.cream/68",
                      display: "block",
                      mb: "2",
                    })}
                  >
                    Attach To Campaign
                  </label>
                  <div
                    class={css({ display: "flex", gap: "2", flexWrap: "wrap" })}
                  >
                    <UISelect
                      id="thesis-campaign-select"
                      data-testid="thesis-campaign-select"
                      aria-invalid={campaignError() ? true : undefined}
                      aria-describedby={
                        campaignError() ? "thesis-campaign-error" : undefined
                      }
                      value={selectedCampaignId()}
                      onChange={(event) => {
                        setCampaignError(null);
                        setSelectedCampaignId(event.currentTarget.value);
                      }}
                    >
                      <option value="">Select campaign</option>
                      <For each={attachableCampaigns()}>
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
                  <Show when={campaignError()}>
                    {(message) => (
                      <p
                        id="thesis-campaign-error"
                        class={css({
                          color: "zodiac.error",
                          fontFamily: "display",
                          fontSize: "sm",
                          mt: "2",
                        })}
                      >
                        {message()}
                      </p>
                    )}
                  </Show>
                </div>

                <UINotice status={notice()} error={noticeError()} />
              </div>

              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Hypotheses</h2>
              <div class={linkList}>
                <For each={row().hypotheses}>
                  {(hypothesis) => (
                    <Link
                      to="/hypotheses/$hypothesisId"
                      params={{ hypothesisId: String(hypothesis._id) }}
                      class={css({
                        color: "zodiac.cream/78",
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
                <h2 class={sectionLabel}>Recipes</h2>
                <div class={linkList}>
                  <For each={row().recipes}>
                    {(recipe) => (
                      <Link
                        to="/recipes/$recipeId"
                        params={{ recipeId: String(recipe._id) }}
                        class={css({
                          color: "zodiac.cream/78",
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
                <h2 class={sectionLabel}>Compositions</h2>
                <div class={linkList}>
                  <For each={row().compositions}>
                    {(composition) => (
                      <Link
                        to="/compositions/$compositionId"
                        params={{ compositionId: String(composition._id) }}
                        class={css({
                          color: "zodiac.cream/78",
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
                <h2 class={sectionLabel}>Recent Weekly Briefs</h2>
                <div class={linkList}>
                  <For each={row().recentWeeklyBriefIds}>
                    {(briefId) => (
                      <Link
                        to="/weekly-turns/$briefId"
                        params={{ briefId: String(briefId) }}
                        class={css({
                          color: "zodiac.cream/78",
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
