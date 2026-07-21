import { Link, useNavigate, useParams } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  Markdown,
  UIBadge,
  UIButton,
  UICard,
  backLink,
  detailTitleClass,
  goldDivider,
  metaLine,
  pageClass,
  sectionLabel,
} from "../components/ui";
import {
  createAction,
  createMutation,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";
import { extractTitle } from "../lib/markdown-utils";

const loopSubheadingClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: "xl",
  fontWeight: "normal",
  lineHeight: "1.35",
  mb: "2",
  mt: "5",
});

const loopEyebrowClass = css({
  color: "rgba(245, 240, 232, 0.62)",
  fontFamily: "mono",
  fontSize: "2xs",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
});

const loopLinkClass = css({
  borderBottom: "1px solid rgba(200, 168, 75, 0.16)",
  color: "inherit",
  display: "grid",
  gap: "1",
  p: "3",
  textDecoration: "none",
  transitionDuration: "normal",
  transitionProperty: "background-color, border-color",
  _hover: {
    bg: "rgba(200, 168, 75, 0.05)",
    borderColor: "rgba(200, 168, 75, 0.42)",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "zodiac.gold",
    outlineOffset: "2px",
  },
});

const reviewQueueBannerClass = css({
  bg: "rgba(245, 240, 232, 0.04)",
  borderColor: "rgba(245, 240, 232, 0.14)",
  borderRadius: "l2",
  borderWidth: "1px",
  color: "zodiac.cream",
  display: "flex",
  flexWrap: "wrap",
  gap: "2",
  justifyContent: "space-between",
  p: "3",
});

const reviewQueueBlockedClass = css({
  bg: "rgba(200, 168, 75, 0.14)",
  borderColor: "rgba(200, 168, 75, 0.62)",
  "& span:last-child": { color: "zodiac.gold" },
});

export function WeeklyBriefDetailPage() {
  const params = useParams({ from: "/weekly-turns/$briefId" });
  const navigate = useNavigate();

  const brief = createQuery(api.weeklyBriefs.get, () => ({
    id: params().briefId as Id<"weeklyBriefs">,
  }));
  const campaignQuery = createQueryWithStatus(api.campaigns.get, () => {
    const campaignId = brief()?.campaignId;
    return campaignId ? { id: campaignId } : "skip";
  });
  const activeThesesQuery = createQuery(api.theses.getByIds, () => ({
    ids: (brief()?.activeThesisIds ?? []) as Id<"theses">[],
  }));
  const referencedFailureEntries = createQuery(api.failures.getByKeys, () => ({
    keys: brief()?.referencedFailureKeys ?? [],
  }));
  const activeTheses = createMemo<Doc<"theses">[]>(
    () => (activeThesesQuery() ?? []) as Doc<"theses">[],
  );
  const campaign = createMemo<Doc<"campaigns"> | null>(
    () => (campaignQuery.data() as Doc<"campaigns"> | null) ?? null,
  );
  const referencedFailures = createMemo(() => referencedFailureEntries() ?? []);

  createEffect(() => {
    const b = brief();
    if (b) document.title = `Week ${b.weekOf} — Frequency Music`;
  });

  const publishToNotion = createAction(api.weeklyBriefs.publishToNotion);
  const createRecapDraft = createMutation(
    api.editorialArtifacts.createDraftFromWeeklyBrief,
  );
  const setFeedEnabled = createMutation(api.feeds.setEnabled);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [publishing, setPublishing] = createSignal(false);
  const [creatingRecap, setCreatingRecap] = createSignal(false);
  const [enablingFeedId, setEnablingFeedId] = createSignal<Id<"feeds"> | null>(
    null,
  );
  const [enabledFeedIds, setEnabledFeedIds] = createSignal<Set<Id<"feeds">>>(
    new Set(),
  );

  async function handlePublish() {
    const b = brief();
    if (!b) return;
    setPublishing(true);
    setNotice(null);
    try {
      const result = await publishToNotion({ id: b._id as Id<"weeklyBriefs"> });
      setNotice(`Published to Notion: ${result.notionUrl ?? "success"}`);
    } catch (error) {
      console.error("Weekly brief publish failed", error);
      setNotice("Publish failed. Please try again or contact support.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleCreateRecap() {
    const b = brief();
    if (!b) return;
    setCreatingRecap(true);
    setNotice(null);
    try {
      const artifactId = await createRecapDraft({
        weeklyBriefId: b._id as Id<"weeklyBriefs">,
      });
      void navigate({
        to: "/editorial/$artifactId",
        params: { artifactId: String(artifactId) },
      });
    } catch (error) {
      console.error("Editorial draft creation failed", error);
      setNotice("Could not create an editorial recap draft.");
    } finally {
      setCreatingRecap(false);
    }
  }

  async function handleEnableFeed(feedId: Id<"feeds">, name: string) {
    setEnablingFeedId(feedId);
    setNotice(null);
    try {
      await setFeedEnabled({ id: feedId, enabled: true });
      setEnabledFeedIds((current) => new Set([...current, feedId]));
      setNotice(`${name} enabled.`);
    } catch (error) {
      console.error("Proposed feed enable failed", error);
      setNotice(`Could not enable ${name}.`);
    } finally {
      setEnablingFeedId(null);
    }
  }

  return (
    <section class={pageClass}>
      <div>
        <Link to="/weekly-turns" class={backLink}>
          <span aria-hidden="true">&larr;</span> Weekly Turns
        </Link>
      </div>

      <Show
        when={brief()}
        fallback={
          <UICard>
            <p class={css({ color: "zodiac.cream" })}>Loading brief...</p>
          </UICard>
        }
      >
        {(b) => (
          <UICard>
            {/* Badges */}
            <div
              class={css({
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "2",
                mb: "2",
              })}
            >
              <UIBadge tone="gold">Week {b().weekOf}</UIBadge>
              <UIBadge tone="cream">{b().visibility}</UIBadge>
              <UIBadge tone="violet">
                {b().recommendedHypothesisIds.length} hypotheses
              </UIBadge>
              <UIBadge tone="violet">
                {b().recommendedRecipeIds.length} recipes
              </UIBadge>
              <UIBadge tone="violet">{b().sourceIds.length} sources</UIBadge>
              <Show when={b().campaignId}>
                <UIBadge tone="gold">campaign</UIBadge>
              </Show>
              <Show when={(b().activeThesisIds ?? []).length > 0}>
                <UIBadge tone="violet">
                  {(b().activeThesisIds ?? []).length} theses
                </UIBadge>
              </Show>
              <Show when={(b().referencedFailureKeys ?? []).length > 0}>
                <UIBadge tone="violet">
                  {(b().referencedFailureKeys ?? []).length} reversals
                </UIBadge>
              </Show>
            </div>

            {/* Title */}
            <h1 class={detailTitleClass}>{extractTitle(b().bodyMd)}</h1>

            {/* Meta */}
            <p class={metaLine}>
              model: {b().model} · prompt: {b().promptVersion}
              <Show when={b().publishedAt}>
                {(ts) => (
                  <>
                    {" · published: "}
                    {new Date(ts()).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </>
                )}
              </Show>
            </p>

            <div
              class={css({
                mt: "3",
                display: "flex",
                gap: "2",
                flexWrap: "wrap",
              })}
            >
              <UIButton
                variant="outline"
                onClick={handleCreateRecap}
                disabled={creatingRecap()}
              >
                {creatingRecap() ? "Creating recap..." : "Create recap draft"}
              </UIButton>
              <Show when={b().visibility === "private"}>
                <UIButton
                  variant="solid"
                  onClick={handlePublish}
                  disabled={publishing()}
                >
                  {publishing() ? "Publishing..." : "Publish to Notion"}
                </UIButton>
              </Show>
            </div>

            <Show when={notice()}>
              {(msg) => (
                <p class={css({ color: "zodiac.cream", mt: "2" })}>{msg()}</p>
              )}
            </Show>

            <Show when={campaign()}>
              {(row) => (
                <>
                  <hr class={goldDivider} />
                  <div class={sectionLabel}>Campaign Context</div>
                  <div
                    class={css({
                      borderColor: "rgba(200, 168, 75, 0.18)",
                      borderRadius: "l2",
                      borderWidth: "1px",
                      p: "3",
                    })}
                  >
                    <div
                      class={css({
                        display: "flex",
                        gap: "2",
                        flexWrap: "wrap",
                        mb: "2",
                      })}
                    >
                      <UIBadge tone="gold">{row().title}</UIBadge>
                      <UIBadge tone="cream">{row().status}</UIBadge>
                    </div>
                    <p class={css({ color: "rgba(245, 240, 232, 0.72)" })}>
                      {row().question}
                    </p>
                  </div>
                </>
              )}
            </Show>

            <hr class={goldDivider} />
            <div class={sectionLabel}>Studio Prompts</div>
            <div class={css({ display: "grid", gap: "3" })}>
              <div
                class={css({
                  borderColor: "rgba(200, 168, 75, 0.18)",
                  borderRadius: "l2",
                  borderWidth: "1px",
                  p: "3",
                })}
              >
                <UIBadge tone="gold">10-minute</UIBadge>
                <div class={css({ mt: "2" })}>
                  <Markdown
                    content={
                      b().studioPrompts?.tenMinuteMd ??
                      "No 10-minute prompt was stored for this older brief."
                    }
                  />
                </div>
              </div>
              <div
                class={css({
                  borderColor: "rgba(200, 168, 75, 0.18)",
                  borderRadius: "l2",
                  borderWidth: "1px",
                  p: "3",
                })}
              >
                <UIBadge tone="gold">30-minute</UIBadge>
                <div class={css({ mt: "2" })}>
                  <Markdown
                    content={
                      b().studioPrompts?.thirtyMinuteMd ??
                      "No 30-minute prompt was stored for this older brief."
                    }
                  />
                </div>
              </div>
              <div
                class={css({
                  borderColor: "rgba(200, 168, 75, 0.18)",
                  borderRadius: "l2",
                  borderWidth: "1px",
                  p: "3",
                })}
              >
                <UIBadge tone="gold">90-minute</UIBadge>
                <div class={css({ mt: "2" })}>
                  <Markdown
                    content={
                      b().studioPrompts?.ninetyMinuteMd ??
                      "No 90-minute prompt was stored for this older brief."
                    }
                  />
                </div>
              </div>
            </div>

            <Show when={(b().recommendedActions ?? []).length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Recommended Actions</div>
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={b().recommendedActions ?? []}>
                  {(action) => {
                    const linkClass = css({
                      borderColor: "rgba(200, 168, 75, 0.18)",
                      borderRadius: "l2",
                      borderWidth: "1px",
                      color: "inherit",
                      display: "block",
                      p: "3",
                      textDecoration: "none",
                    });
                    const cardBody = (
                      <>
                        <div
                          class={css({
                            display: "flex",
                            gap: "2",
                            flexWrap: "wrap",
                            mb: "1",
                          })}
                        >
                          <UIBadge tone="gold">{action.durationBucket}</UIBadge>
                          <UIBadge tone="cream">{action.kind}</UIBadge>
                        </div>
                        <div class={css({ color: "zodiac.cream", mb: "1" })}>
                          {action.targetType} {action.targetId.slice(-6)}
                        </div>
                        <div
                          class={css({ color: "rgba(245, 240, 232, 0.68)" })}
                        >
                          {action.reason}
                        </div>
                      </>
                    );
                    return action.targetType === "hypothesis" ? (
                      <Link
                        to="/hypotheses/$hypothesisId"
                        params={{ hypothesisId: action.targetId }}
                        class={linkClass}
                      >
                        {cardBody}
                      </Link>
                    ) : action.targetType === "recipe" ? (
                      <Link
                        to="/recipes/$recipeId"
                        params={{ recipeId: action.targetId }}
                        class={linkClass}
                      >
                        {cardBody}
                      </Link>
                    ) : (
                      <Link
                        to="/compositions/$compositionId"
                        params={{ compositionId: action.targetId }}
                        class={linkClass}
                      >
                        {cardBody}
                      </Link>
                    );
                  }}
                </For>
              </div>
            </Show>

            <Show when={b().loopReport}>
              {(loopReport) => (
                <>
                  <hr class={goldDivider} />
                  <div class={sectionLabel}>Loop Report</div>

                  <h2 class={loopSubheadingClass}>Correspondence movement</h2>
                  <dl
                    class={css({
                      borderBottom: "1px solid rgba(245, 240, 232, 0.1)",
                      borderTop: "1px solid rgba(245, 240, 232, 0.1)",
                      display: "grid",
                      gridTemplateColumns: {
                        base: "repeat(2, minmax(0, 1fr))",
                        md: "repeat(4, minmax(0, 1fr))",
                      },
                      m: "0",
                    })}
                  >
                    <For
                      each={[
                        {
                          label: "New conjectures",
                          value: loopReport().correspondences.newConjectures,
                        },
                        {
                          label: "Evidence added",
                          value: loopReport().correspondences.gainedEvidence,
                        },
                        {
                          label: "Contradicted",
                          value: loopReport().correspondences.contradicted,
                        },
                        {
                          label: "Auto-retired",
                          value: loopReport().correspondences.autoRetired,
                        },
                      ]}
                    >
                      {(stat) => (
                        <div class={css({ p: { base: "3", md: "4" } })}>
                          <dt class={loopEyebrowClass}>{stat.label}</dt>
                          <dd
                            class={css({
                              color: "zodiac.gold",
                              fontFamily: "mono",
                              fontSize: "xl",
                              m: "0",
                              mt: "1",
                            })}
                          >
                            {stat.value}
                          </dd>
                        </div>
                      )}
                    </For>
                  </dl>

                  <Show
                    when={loopReport().correspondences.topMovers.length > 0}
                  >
                    <h3 class={loopSubheadingClass}>Top movers</h3>
                    <div
                      class={css({
                        borderTop: "1px solid rgba(200, 168, 75, 0.16)",
                      })}
                    >
                      <For each={loopReport().correspondences.topMovers}>
                        {(mover) => (
                          <Link
                            to="/correspondences/$correspondenceId"
                            params={{
                              correspondenceId: String(mover.correspondenceId),
                            }}
                            class={loopLinkClass}
                          >
                            <span
                              class={css({
                                alignItems: "center",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "2",
                                justifyContent: "space-between",
                              })}
                            >
                              <span>{mover.statement}</span>
                              <span class={loopEyebrowClass}>
                                {mover.status} · +{mover.evidenceDelta} evidence
                              </span>
                            </span>
                          </Link>
                        )}
                      </For>
                    </div>
                  </Show>

                  <h2 class={loopSubheadingClass}>Review queue</h2>
                  <div
                    role="status"
                    class={`${reviewQueueBannerClass} ${
                      loopReport().reviewQueue.agentBlocked
                        ? reviewQueueBlockedClass
                        : ""
                    }`}
                  >
                    <span>
                      <strong>{loopReport().reviewQueue.pendingDrafts}</strong>
                      {" pending hypothesis drafts"}
                      <Show
                        when={
                          loopReport().reviewQueue.oldestPendingDays !==
                          undefined
                        }
                      >
                        {` · oldest ${loopReport().reviewQueue.oldestPendingDays}d`}
                      </Show>
                    </span>
                    <span class={loopEyebrowClass}>
                      {loopReport().reviewQueue.agentBlocked
                        ? `Agent blocked at cap ${loopReport().reviewQueue.cap}`
                        : `${loopReport().reviewQueue.pendingDrafts} of ${loopReport().reviewQueue.cap} slots`}
                    </span>
                  </div>

                  <h2 class={loopSubheadingClass}>Experiment debt</h2>
                  <Show
                    when={loopReport().experimentDebt.length > 0}
                    fallback={
                      <p class={css({ color: "rgba(245, 240, 232, 0.68)" })}>
                        No recipes are waiting on composition or listening.
                      </p>
                    }
                  >
                    <div
                      class={css({
                        borderTop: "1px solid rgba(200, 168, 75, 0.16)",
                      })}
                    >
                      <For each={loopReport().experimentDebt}>
                        {(debt) => (
                          <Link
                            to="/recipes/$recipeId"
                            params={{ recipeId: String(debt.recipeId) }}
                            class={loopLinkClass}
                          >
                            <span
                              class={css({
                                alignItems: "center",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "2",
                                justifyContent: "space-between",
                              })}
                            >
                              <span>{debt.title}</span>
                              <span class={loopEyebrowClass}>
                                {debt.state === "in_use_no_composition"
                                  ? "Needs composition"
                                  : "Needs listening"}
                                {` · ${debt.ageDays}d`}
                              </span>
                            </span>
                          </Link>
                        )}
                      </For>
                    </div>
                  </Show>

                  <Show when={loopReport().proposedFeeds.length > 0}>
                    <h2 class={loopSubheadingClass}>Proposed feeds</h2>
                    <div
                      class={css({
                        borderTop: "1px solid rgba(200, 168, 75, 0.16)",
                        display: "grid",
                      })}
                    >
                      <For each={loopReport().proposedFeeds}>
                        {(feed) => {
                          const enabled = () =>
                            enabledFeedIds().has(feed.feedId);
                          return (
                            <div
                              class={css({
                                alignItems: { base: "start", md: "center" },
                                borderBottom:
                                  "1px solid rgba(200, 168, 75, 0.16)",
                                display: "flex",
                                flexDirection: { base: "column", md: "row" },
                                gap: "3",
                                justifyContent: "space-between",
                                p: "3",
                              })}
                            >
                              <div>
                                <a
                                  href={feed.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  class={css({
                                    color: "zodiac.cream",
                                    textDecorationColor:
                                      "rgba(200, 168, 75, 0.45)",
                                    textUnderlineOffset: "3px",
                                  })}
                                >
                                  {feed.name}
                                </a>
                                <p
                                  class={css({
                                    color: "rgba(245, 240, 232, 0.68)",
                                    m: "0",
                                    mt: "1",
                                  })}
                                >
                                  {feed.rationale}
                                </p>
                              </div>
                              <UIButton
                                type="button"
                                variant={enabled() ? "ghost" : "solid"}
                                disabled={
                                  enabled() || enablingFeedId() === feed.feedId
                                }
                                onClick={() =>
                                  void handleEnableFeed(feed.feedId, feed.name)
                                }
                              >
                                {enabled()
                                  ? "Enabled"
                                  : enablingFeedId() === feed.feedId
                                    ? "Enabling..."
                                    : "Enable"}
                              </UIButton>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                </>
              )}
            </Show>

            {/* Rendered Markdown Body */}
            <hr class={goldDivider} />
            <Markdown content={b().bodyMd} />

            {/* Todo Items */}
            <Show when={(b().todo ?? []).length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Action Items</div>
              <ul
                class={css({
                  color: "rgba(245, 240, 232, 0.7)",
                  fontFamily: "display",
                  listStyleType: "disc",
                  pl: "5",
                })}
              >
                <For each={b().todo}>
                  {(item) => <li class={css({ py: "1" })}>{item}</li>}
                </For>
              </ul>
            </Show>

            <Show when={activeTheses().length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Active Theses</div>
              <div class={css({ display: "flex", gap: "2", flexWrap: "wrap" })}>
                <For each={activeTheses()}>
                  {(thesis) => (
                    <Link
                      to="/theses/$thesisId"
                      params={{ thesisId: String(thesis._id) }}
                      class={css({ textDecoration: "none" })}
                    >
                      <UIBadge tone="gold">{thesis.title}</UIBadge>
                    </Link>
                  )}
                </For>
              </div>
            </Show>

            <Show when={referencedFailures().length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Referenced Reversals</div>
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={referencedFailures()}>
                  {(failure) => (
                    <Link
                      to="/failures"
                      hash={failure.key}
                      class={css({
                        borderColor: "rgba(200, 168, 75, 0.18)",
                        borderRadius: "l2",
                        borderWidth: "1px",
                        color: "rgba(245, 240, 232, 0.76)",
                        display: "block",
                        p: "3",
                        textDecoration: "none",
                      })}
                    >
                      <div
                        class={css({
                          display: "flex",
                          gap: "2",
                          flexWrap: "wrap",
                          mb: "1",
                        })}
                      >
                        <UIBadge tone="cream">{failure.reason}</UIBadge>
                        <UIBadge tone="violet">
                          {failure.recommendedNextAction}
                        </UIBadge>
                      </div>
                      <div>{failure.title}</div>
                    </Link>
                  )}
                </For>
              </div>
            </Show>

            {/* Footer meta */}
            <hr class={goldDivider} />
            <div class={metaLine}>
              Created:{" "}
              {new Date(b().createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              {" | "}Visibility: {b().visibility}
              <Show when={b().notionPageId}>
                {(id) => (
                  <>
                    {" | "}Notion: {id()}
                  </>
                )}
              </Show>
            </div>
          </UICard>
        )}
      </Show>
    </section>
  );
}
