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
  const referencedFailureEntries = createQuery(
    api.failures.getByKeys,
    () => ({
      keys: brief()?.referencedFailureKeys ?? [],
    }),
  );
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
  const [notice, setNotice] = createSignal<string | null>(null);
  const [publishing, setPublishing] = createSignal(false);
  const [creatingRecap, setCreatingRecap] = createSignal(false);

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
      navigate({
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
