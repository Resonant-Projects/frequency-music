import { Link, useNavigate, useParams } from "@tanstack/solid-router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import { entityCellClass } from "../components/entity-card";
import { StatTiles } from "../components/stat-tiles";
import {
  backLink,
  collapsedNoticeClass,
  detailTitleClass,
  fieldLabelClass,
  focusRingClass,
  goldDivider,
  pageClass,
  proseClass,
  sectionLabel,
  UIBadge,
  UIButton,
  UICard,
  UINotice,
  UISelect,
} from "../components/ui";
import {
  createMutation,
  createQueryWithStatus,
  describeError,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

const linkList = css({
  display: "grid",
  gap: "2",
  listStyle: "none",
});

const linkListItem = cx(
  css({
    alignItems: "center",
    color: "zodiac.cream/78",
    display: "inline-flex",
    minH: "6",
    textDecoration: "none",
    _hover: { color: "zodiac.cream", textDecoration: "underline" },
    _coarsePointer: { minH: "11" },
  }),
  focusRingClass,
);

export function ThesisDetailPage() {
  const params = useParams({ from: "/theses/$thesisId" });
  const navigate = useNavigate();
  const detailQuery = createQueryWithStatus(api.theses.getDetail, () => ({
    id: params().thesisId as Id<"theses">,
  }));
  const detail = detailQuery.data;
  const campaignsQuery = createQueryWithStatus(api.campaigns.listForSelection);
  const campaigns = campaignsQuery.data;
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
  const [detaching, setDetaching] = createSignal<Id<"campaigns"> | null>(null);
  let campaignsHeading: HTMLHeadingElement | undefined;
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

  onMount(() => {
    document.title = "Thesis — Frequency Music";
  });

  createEffect(() => {
    const thesis = detail()?.thesis;
    if (thesis) document.title = `${thesis.title} — Frequency Music`;
  });

  const loadErrorText = () =>
    detailQuery.error()
      ? `Unable to load thesis: ${detailQuery.error()?.message}`
      : null;
  const loadStatus = () => {
    if (detailQuery.error() || detail()) return null;
    return detailQuery.isLoading() ? "Loading thesis..." : "Thesis not found.";
  };

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
      setNoticeError(`Attach failed: ${describeError(error)}`);
    }
  }

  async function handleDetach(campaignId: Id<"campaigns">) {
    if (detaching()) return;
    setDetaching(campaignId);
    setNotice(null);
    setNoticeError(null);
    try {
      await detachThesis({
        campaignId,
        thesisId: params().thesisId as Id<"theses">,
      });
      setNotice("Thesis detached from campaign.");
      // The detached row unmounts with the next Convex push; hand focus to
      // the section heading first so it never falls to <body>.
      queueMicrotask(() => campaignsHeading?.focus());
    } catch (error) {
      setNoticeError(`Detach failed: ${describeError(error)}`);
    } finally {
      setDetaching(null);
    }
  }

  async function handleCreateSummary() {
    if (creatingSummary()) return;
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
      setNoticeError(`Summary draft failed: ${describeError(error)}`);
    } finally {
      setCreatingSummary(false);
    }
  }

  async function handleCreateChangedMind(hypothesisId: Id<"hypotheses">) {
    if (creatingChangedMind()) return;
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
      setNoticeError(`Changed-mind draft failed: ${describeError(error)}`);
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

      <UICard class={detail() ? collapsedNoticeClass : undefined}>
        <UINotice status={loadStatus()} error={loadErrorText()} />
      </UICard>

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
                <UIBadge tone="cream">
                  {row().hypotheses.length} hypotheses
                </UIBadge>
                <UIBadge tone="cream">{row().recipes.length} recipes</UIBadge>
                <UIBadge tone="cream">
                  {row().compositions.length} compositions
                </UIBadge>
              </div>

              <h1 class={detailTitleClass}>{row().thesis.title}</h1>
              <p
                class={css({
                  color: "zodiac.cream/82",
                  fontFamily: "display",
                  fontSize: "lg",
                  lineHeight: "1.7",
                  maxW: "72ch",
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
                  aria-busy={creatingSummary()}
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
                      aria-busy={creatingChangedMind()}
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
                    <p class={cx(proseClass, css({ whiteSpace: "pre-wrap" }))}>
                      {description()}
                    </p>
                  </>
                )}
              </Show>

              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Thesis Signals</h2>
              <StatTiles
                items={[
                  {
                    label: "contradictions",
                    value: row().stats.contradictionCount,
                  },
                  { label: "active", value: row().stats.activeCount },
                  { label: "evaluated", value: row().stats.evaluatedCount },
                  { label: "retired", value: row().stats.retiredCount },
                ]}
              />

              <hr class={goldDivider} />
              <h2
                id="thesis-campaigns-heading"
                ref={(element) => {
                  campaignsHeading = element;
                }}
                tabIndex={-1}
                class={sectionLabel}
              >
                Campaign Membership
              </h2>
              <div class={css({ display: "grid", gap: "3" })}>
                <Show
                  when={row().campaigns.length > 0}
                  fallback={
                    <p class={css({ color: "zodiac.cream/66" })}>
                      This thesis is not attached to a campaign yet.
                    </p>
                  }
                >
                  <For each={row().campaigns}>
                    {(campaign) => (
                      <div
                        class={cx(
                          entityCellClass,
                          css({
                            alignItems: "center",
                            display: "flex",
                            gap: "3",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                          }),
                        )}
                      >
                        <div class={css({ minW: 0 })}>
                          <div class={css({ color: "zodiac.cream", mb: "1" })}>
                            {campaign.title}
                          </div>
                          <div
                            class={css({
                              color: "zodiac.cream/66",
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
                            aria-busy={detaching() === campaign._id}
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
                    class={cx(fieldLabelClass, css({ "&&": { mt: "0" } }))}
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

                <UINotice
                  status={notice()}
                  error={
                    noticeError() ??
                    campaignError() ??
                    (campaignsQuery.error()
                      ? `Unable to load campaigns: ${campaignsQuery.error()?.message}`
                      : null)
                  }
                />
              </div>

              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Hypotheses</h2>
              <ul role="list" class={linkList}>
                <For each={row().hypotheses}>
                  {(hypothesis) => (
                    <li>
                      <Link
                        to="/hypotheses/$hypothesisId"
                        params={{ hypothesisId: String(hypothesis._id) }}
                        class={linkListItem}
                      >
                        {hypothesis.title}
                      </Link>
                    </li>
                  )}
                </For>
              </ul>

              <Show when={row().recipes.length > 0}>
                <hr class={goldDivider} />
                <h2 class={sectionLabel}>Recipes</h2>
                <ul role="list" class={linkList}>
                  <For each={row().recipes}>
                    {(recipe) => (
                      <li>
                        <Link
                          to="/recipes/$recipeId"
                          params={{ recipeId: String(recipe._id) }}
                          class={linkListItem}
                        >
                          {recipe.title}
                        </Link>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>

              <Show when={row().compositions.length > 0}>
                <hr class={goldDivider} />
                <h2 class={sectionLabel}>Compositions</h2>
                <ul role="list" class={linkList}>
                  <For each={row().compositions}>
                    {(composition) => (
                      <li>
                        <Link
                          to="/compositions/$compositionId"
                          params={{ compositionId: String(composition._id) }}
                          class={linkListItem}
                        >
                          {composition.title}
                        </Link>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>

              <Show when={row().recentWeeklyBriefIds.length > 0}>
                <hr class={goldDivider} />
                <h2 class={sectionLabel}>Recent Weekly Briefs</h2>
                <ul role="list" class={linkList}>
                  <For each={row().recentWeeklyBriefIds}>
                    {(briefId) => (
                      <li>
                        <Link
                          to="/weekly-turns/$briefId"
                          params={{ briefId: String(briefId) }}
                          class={linkListItem}
                        >
                          Weekly brief {String(briefId).slice(-6)}
                        </Link>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </UICard>
          </>
        )}
      </Show>
    </section>
  );
}
