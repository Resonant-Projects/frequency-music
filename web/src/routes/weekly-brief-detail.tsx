import { Link, useNavigate, useParams } from "@tanstack/solid-router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import { RecommendedActionCard } from "../components/recommended-action-card";
import {
  Markdown,
  UIBadge,
  UIButton,
  UICard,
  UINotice,
  UITextarea,
  backLink,
  detailTitleClass,
  fieldLabelClass,
  focusRingClass,
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
  describeError,
  useConvexClient,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";
import { MAX_FEED_ENABLE_STATE_IDS } from "../../../convex/shared/agentContract";
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
  color: "zodiac.cream/66",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
});

const loopLinkClass = css({
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "zodiac.gold/16",
  color: "inherit",
  display: "grid",
  gap: "1",
  p: "3",
  textDecoration: "none",
  transitionDuration: "normal",
  transitionProperty: "background-color, border-color",
  _hover: {
    bg: "zodiac.gold/5",
    borderColor: "zodiac.gold/42",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "zodiac.gold",
    outlineOffset: "2px",
  },
});

const reviewQueueBannerClass = css({
  bg: "zodiac.cream/4",
  borderColor: "zodiac.cream/14",
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
  bg: "zodiac.gold/14",
  borderColor: "zodiac.gold/62",
  "& span:last-child": { color: "zodiac.gold" },
});

const violetAccentContainerClass = css({
  bg: "zodiac.violet/7",
  borderColor: "zodiac.violet/30",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "grid",
  mt: "3",
  p: "3",
});

const studioPromptBoxClass = css({
  borderColor: "zodiac.gold/18",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "3",
});

/** One stored studio prompt, or the fallback copy for an older brief. */
function StudioPromptBox(props: { label: string; content: string }) {
  return (
    <div class={studioPromptBoxClass}>
      <UIBadge tone="gold">{props.label}</UIBadge>
      <div class={css({ mt: "2" })}>
        <Markdown content={props.content} />
      </div>
    </div>
  );
}

const TITLE_LINE = /^#\s+.+(?:\r?\n)?/m;

/**
 * The body without the `# …` line that `extractTitle` lifts into the page
 * `<h1>`, so the rendered markdown does not emit a second `<h1>`.
 */
function bodyWithoutTitle(bodyMd: string): string {
  return bodyMd.replace(TITLE_LINE, "");
}

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.join(",") === right.join(",");

type FeedEnableState = { id: Id<"feeds">; enabled: boolean };

function createLiveFeedStates(feedIds: () => Id<"feeds">[]) {
  const convex = useConvexClient();
  const [states, setStates] = createSignal<FeedEnableState[]>([]);

  createEffect(() => {
    const ids = feedIds();
    const statesByBatch: FeedEnableState[][] = [];
    const unsubscribes: Array<() => void> = [];
    setStates([]);

    for (
      let start = 0;
      start < ids.length;
      start += MAX_FEED_ENABLE_STATE_IDS
    ) {
      const batchIndex = start / MAX_FEED_ENABLE_STATE_IDS;
      const batchIds = ids.slice(start, start + MAX_FEED_ENABLE_STATE_IDS);
      unsubscribes.push(
        convex.onUpdate(
          api.feeds.getByIds,
          { ids: batchIds },
          (result) => {
            statesByBatch[batchIndex] = result;
            setStates(statesByBatch.flat());
          },
          (error) => {
            console.error("Feed enable-state subscription failed", error);
          },
        ),
      );
    }

    onCleanup(() => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    });
  });

  return states;
}

export function WeeklyBriefDetailPage() {
  const params = useParams({ from: "/weekly-turns/$briefId" });
  const navigate = useNavigate();

  const briefQuery = createQueryWithStatus(api.weeklyBriefs.get, () => ({
    id: params().briefId as Id<"weeklyBriefs">,
  }));
  const brief = briefQuery.data;
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
  // Compared by value: `brief()` changes on every field update, and a fresh
  // array here would resubscribe every `getByIds` batch.
  const proposedFeedIds = createMemo(
    () => (brief()?.loopReport?.proposedFeeds ?? []).map((feed) => feed.feedId),
    [],
    { equals: sameIds },
  );
  const liveFeedStates = createLiveFeedStates(proposedFeedIds);
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
  const publishBrief = createMutation(api.weeklyBriefs.publish);
  const editBrief = createMutation(api.weeklyBriefs.editBrief);
  const createRecapDraft = createMutation(
    api.editorialArtifacts.createDraftFromWeeklyBrief,
  );
  const setFeedEnabled = createMutation(api.feeds.setEnabled);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  const [publishingToNotion, setPublishingToNotion] = createSignal(false);
  const [publishingBrief, setPublishingBrief] = createSignal(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = createSignal(false);
  const [editMode, setEditMode] = createSignal(false);
  const [savingEdit, setSavingEdit] = createSignal(false);
  const [bodyMd, setBodyMd] = createSignal("");
  const [todoText, setTodoText] = createSignal("");
  const [tenMinuteMd, setTenMinuteMd] = createSignal("");
  const [thirtyMinuteMd, setThirtyMinuteMd] = createSignal("");
  const [ninetyMinuteMd, setNinetyMinuteMd] = createSignal("");
  const [creatingRecap, setCreatingRecap] = createSignal(false);
  const [enablingFeedId, setEnablingFeedId] = createSignal<Id<"feeds"> | null>(
    null,
  );
  const [enabledFeedIds, setEnabledFeedIds] = createSignal<Set<Id<"feeds">>>(
    new Set(),
  );

  createEffect(
    on(
      () => params().briefId,
      () => {
        setEditMode(false);
        setSavingEdit(false);
        setBodyMd("");
        setTodoText("");
        setTenMinuteMd("");
        setThirtyMinuteMd("");
        setNinetyMinuteMd("");
        setNotice(null);
        setNoticeError(null);
        setPublishConfirmOpen(false);
        setPublishingBrief(false);
      },
    ),
  );

  const editedFields = createMemo(() => {
    const row = brief();
    if (!row || !editMode()) return [];
    const fields: string[] = [];
    if (bodyMd() !== row.bodyMd) fields.push("bodyMd");
    if (
      JSON.stringify(parseTodo(todoText())) !== JSON.stringify(row.todo ?? [])
    ) {
      fields.push("todo");
    }
    if (
      tenMinuteMd() !== (row.studioPrompts?.tenMinuteMd ?? "") ||
      thirtyMinuteMd() !== (row.studioPrompts?.thirtyMinuteMd ?? "") ||
      ninetyMinuteMd() !== (row.studioPrompts?.ninetyMinuteMd ?? "")
    ) {
      fields.push("studioPrompts");
    }
    return fields;
  });

  function parseTodo(value: string) {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function beginEdit() {
    const row = brief();
    if (!row || editMode() || savingEdit()) return;
    setBodyMd(row.bodyMd);
    setTodoText((row.todo ?? []).join("\n"));
    setTenMinuteMd(row.studioPrompts?.tenMinuteMd ?? "");
    setThirtyMinuteMd(row.studioPrompts?.thirtyMinuteMd ?? "");
    setNinetyMinuteMd(row.studioPrompts?.ninetyMinuteMd ?? "");
    setNotice(null);
    setNoticeError(null);
    setEditMode(true);
    queueMicrotask(() => bodyField?.focus());
  }

  function closeEdit() {
    setEditMode(false);
    editTrigger?.focus();
  }

  // Focus handling for the publish confirmation dialog.
  let publishTrigger: HTMLButtonElement | null = null;
  // "Edit brief" outlives the edit panel, so closing the panel returns there.
  let editTrigger: HTMLButtonElement | undefined;
  let bodyField: HTMLTextAreaElement | undefined;
  // The title outlives every visibility change, so it is the fallback whenever
  // the trigger will not survive the dialog closing.
  let briefTitle: HTMLHeadingElement | null = null;

  function openPublishConfirm(trigger: HTMLButtonElement) {
    publishTrigger = trigger;
    setPublishConfirmOpen(true);
  }

  function dismissPublishConfirm(focusTarget: HTMLElement | null) {
    setPublishConfirmOpen(false);
    publishTrigger = null;
    focusTarget?.focus();
  }

  function closePublishConfirm() {
    // Cancel and Escape leave the brief private, so the trigger is still there.
    dismissPublishConfirm(
      publishTrigger?.isConnected ? publishTrigger : briefTitle,
    );
  }

  async function handleSaveEdit() {
    const row = brief();
    const fields = editedFields();
    if (!row || fields.length === 0 || savingEdit()) return;
    setSavingEdit(true);
    setNotice(null);
    setNoticeError(null);
    try {
      await editBrief({
        id: row._id,
        ...(fields.includes("bodyMd") ? { bodyMd: bodyMd() } : {}),
        ...(fields.includes("todo") ? { todo: parseTodo(todoText()) } : {}),
        ...(fields.includes("studioPrompts")
          ? {
              studioPrompts: {
                tenMinuteMd: tenMinuteMd(),
                thirtyMinuteMd: thirtyMinuteMd(),
                ninetyMinuteMd: ninetyMinuteMd(),
              },
            }
          : {}),
      });
      closeEdit();
      setNotice("Weekly brief changes saved with edit provenance.");
    } catch (error) {
      setNoticeError(describeError(error));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handlePublishToNotion() {
    const b = brief();
    if (!b || publishingToNotion()) return;
    setPublishingToNotion(true);
    setNotice(null);
    setNoticeError(null);
    try {
      const result = await publishToNotion({ id: b._id as Id<"weeklyBriefs"> });
      // The button sits inside a not-yet-in-Notion <Show>, and the page id
      // that unmounts it arrives after this action resolves.
      briefTitle?.focus();
      setNotice(`Published to Notion: ${result.notionUrl ?? "success"}`);
    } catch (error) {
      console.error("Weekly brief publish failed", error);
      setNoticeError("Publish failed. Please try again or contact support.");
    } finally {
      setPublishingToNotion(false);
    }
  }

  async function handlePublishBrief() {
    const row = brief();
    if (!row || publishingBrief()) return;
    setPublishingBrief(true);
    setNotice(null);
    setNoticeError(null);
    try {
      await publishBrief({ id: row._id });
      // The trigger sits inside a private-only <Show>. It is still connected
      // at this point, but the visibility push that follows unmounts it, so
      // focusing it here would land focus on <body> a moment later.
      dismissPublishConfirm(briefTitle);
      setNotice("Weekly brief published in the app.");
    } catch (error) {
      setNoticeError(describeError(error));
    } finally {
      setPublishingBrief(false);
    }
  }

  async function handleCreateRecap() {
    const b = brief();
    if (!b || creatingRecap()) return;
    setCreatingRecap(true);
    setNotice(null);
    setNoticeError(null);
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
      setNoticeError("Could not create an editorial recap draft.");
    } finally {
      setCreatingRecap(false);
    }
  }

  async function handleEnableFeed(feedId: Id<"feeds">, name: string) {
    if (enablingFeedId() !== null) return;
    setEnablingFeedId(feedId);
    setNotice(null);
    setNoticeError(null);
    try {
      await setFeedEnabled({ id: feedId, enabled: true });
      setEnabledFeedIds((current) => new Set([...current, feedId]));
      setNotice(`${name} enabled.`);
    } catch (error) {
      console.error("Proposed feed enable failed", error);
      setNoticeError(`Could not enable ${name}.`);
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

      <UINotice
        status={
          briefQuery.isLoading()
            ? "Loading brief..."
            : !brief() && !briefQuery.isError()
              ? "Weekly brief not found."
              : null
        }
        error={
          briefQuery.isError()
            ? `Unable to load brief: ${briefQuery.error()?.message}`
            : null
        }
      />

      <Show when={brief()}>
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
              <UIBadge tone="cream">
                {b().recommendedRecipeIds.length} recipes
              </UIBadge>
              <UIBadge tone="cream">{b().sourceIds.length} sources</UIBadge>
              <Show when={b().campaignId}>
                <UIBadge tone="gold">campaign</UIBadge>
              </Show>
              <Show when={(b().activeThesisIds ?? []).length > 0}>
                <UIBadge tone="cream">
                  {(b().activeThesisIds ?? []).length} theses
                </UIBadge>
              </Show>
              <Show when={(b().referencedFailureKeys ?? []).length > 0}>
                <UIBadge tone="cream">
                  {(b().referencedFailureKeys ?? []).length} reversals
                </UIBadge>
              </Show>
            </div>

            {/* Title */}
            <h1
              ref={(element) => {
                briefTitle = element;
              }}
              tabindex="-1"
              class={detailTitleClass}
            >
              {extractTitle(b().bodyMd)}
            </h1>

            {/* Meta */}
            <p class={metaLine}>
              model: {b().model} · prompt: {b().promptVersion}
              <Show when={b().publishedAt}>
                {(ts) => (
                  <>
                    {" · published: "}
                    <time datetime={new Date(ts()).toISOString()}>
                      {new Date(ts()).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
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
                onClick={() => void handleCreateRecap()}
                aria-busy={creatingRecap()}
                aria-disabled={creatingRecap() || undefined}
              >
                {creatingRecap() ? "Creating recap..." : "Create recap draft"}
              </UIButton>
              <UIButton
                ref={(element) => {
                  editTrigger = element;
                }}
                variant="outline"
                onClick={beginEdit}
                aria-expanded={editMode()}
                aria-controls="weekly-brief-edit-panel"
                aria-disabled={editMode() || savingEdit() || undefined}
              >
                Edit brief
              </UIButton>
              <Show when={b().visibility === "private"}>
                <UIButton
                  variant={publishConfirmOpen() ? "outline" : "solid"}
                  onClick={(event) => openPublishConfirm(event.currentTarget)}
                  aria-haspopup="dialog"
                  aria-expanded={publishConfirmOpen()}
                  aria-controls="weekly-brief-publish-dialog"
                  disabled={publishingBrief()}
                >
                  Publish brief
                </UIButton>
              </Show>
              <Show when={!b().notionPageId}>
                <UIButton
                  variant="outline"
                  onClick={() => void handlePublishToNotion()}
                  aria-busy={publishingToNotion()}
                  aria-disabled={publishingToNotion() || undefined}
                >
                  {publishingToNotion() ? "Publishing..." : "Publish to Notion"}
                </UIButton>
              </Show>
            </div>

            <Show when={publishConfirmOpen()}>
              <div
                id="weekly-brief-publish-dialog"
                role="dialog"
                aria-modal="false"
                aria-label="Confirm weekly brief publication"
                ref={(element) => {
                  queueMicrotask(() =>
                    element.querySelector("button")?.focus(),
                  );
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.stopPropagation();
                  closePublishConfirm();
                }}
                class={cx(violetAccentContainerClass, css({ gap: "3" }))}
              >
                <p class={css({ color: "zodiac.cream/72" })}>
                  Publishing makes this weekly brief public in the app and
                  records its publication time.
                </p>
                <div
                  class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}
                >
                  <UIButton
                    variant="solid"
                    aria-busy={publishingBrief()}
                    aria-disabled={publishingBrief() || undefined}
                    onClick={() => void handlePublishBrief()}
                  >
                    {publishingBrief() ? "Publishing..." : "Confirm publish"}
                  </UIButton>
                  <UIButton
                    variant="ghost"
                    disabled={publishingBrief()}
                    onClick={() => closePublishConfirm()}
                  >
                    Cancel
                  </UIButton>
                </div>
              </div>
            </Show>

            <Show when={editMode()}>
              <div
                id="weekly-brief-edit-panel"
                class={cx(violetAccentContainerClass, css({ gap: "2" }))}
              >
                <div
                  class={css({
                    alignItems: "center",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "2",
                    justifyContent: "space-between",
                  })}
                >
                  <h2 class={sectionLabel}>Edit generated brief</h2>
                  <div
                    class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}
                  >
                    <For each={editedFields()}>
                      {(field) => (
                        <UIBadge tone="violet">changed: {field}</UIBadge>
                      )}
                    </For>
                  </div>
                </div>
                <p class={css({ color: "zodiac.cream/68" })}>
                  Saved changes preserve the generated and edited values as eval
                  provenance.
                </p>
                <label class={fieldLabelClass} for="weekly-brief-body">
                  Brief markdown
                </label>
                <UITextarea
                  ref={(element) => {
                    bodyField = element;
                  }}
                  id="weekly-brief-body"
                  value={bodyMd()}
                  onInput={(event) => setBodyMd(event.currentTarget.value)}
                  class={css({ minH: "96" })}
                />
                <label class={fieldLabelClass} for="weekly-brief-todo">
                  Action items (one per line)
                </label>
                <UITextarea
                  id="weekly-brief-todo"
                  value={todoText()}
                  onInput={(event) => setTodoText(event.currentTarget.value)}
                />
                <label class={fieldLabelClass} for="weekly-brief-prompt-10">
                  10-minute studio prompt
                </label>
                <UITextarea
                  id="weekly-brief-prompt-10"
                  value={tenMinuteMd()}
                  onInput={(event) => setTenMinuteMd(event.currentTarget.value)}
                />
                <label class={fieldLabelClass} for="weekly-brief-prompt-30">
                  30-minute studio prompt
                </label>
                <UITextarea
                  id="weekly-brief-prompt-30"
                  value={thirtyMinuteMd()}
                  onInput={(event) =>
                    setThirtyMinuteMd(event.currentTarget.value)
                  }
                />
                <label class={fieldLabelClass} for="weekly-brief-prompt-90">
                  90-minute studio prompt
                </label>
                <UITextarea
                  id="weekly-brief-prompt-90"
                  value={ninetyMinuteMd()}
                  onInput={(event) =>
                    setNinetyMinuteMd(event.currentTarget.value)
                  }
                />
                <div
                  class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}
                >
                  <UIButton
                    variant="outline"
                    aria-busy={savingEdit()}
                    aria-disabled={
                      savingEdit() || editedFields().length === 0 || undefined
                    }
                    onClick={() => void handleSaveEdit()}
                  >
                    {savingEdit() ? "Saving..." : "Save changes"}
                  </UIButton>
                  <UIButton
                    variant="ghost"
                    disabled={savingEdit()}
                    onClick={closeEdit}
                  >
                    Cancel
                  </UIButton>
                </div>
              </div>
            </Show>

            <UINotice
              class={css({ mt: "2" })}
              status={notice()}
              error={noticeError()}
            />

            <Show when={campaign()}>
              {(row) => (
                <>
                  <hr class={goldDivider} />
                  <h2 class={sectionLabel}>Campaign Context</h2>
                  <div
                    class={css({
                      borderColor: "zodiac.gold/18",
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
                    <p class={css({ color: "zodiac.cream/72" })}>
                      {row().question}
                    </p>
                  </div>
                </>
              )}
            </Show>

            <hr class={goldDivider} />
            <h2 class={sectionLabel}>Studio Prompts</h2>
            <div class={css({ display: "grid", gap: "3" })}>
              <StudioPromptBox
                label="10-minute"
                content={
                  b().studioPrompts?.tenMinuteMd ??
                  "No 10-minute prompt was stored for this older brief."
                }
              />
              <StudioPromptBox
                label="30-minute"
                content={
                  b().studioPrompts?.thirtyMinuteMd ??
                  "No 30-minute prompt was stored for this older brief."
                }
              />
              <StudioPromptBox
                label="90-minute"
                content={
                  b().studioPrompts?.ninetyMinuteMd ??
                  "No 90-minute prompt was stored for this older brief."
                }
              />
            </div>

            <Show when={(b().recommendedActions ?? []).length > 0}>
              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Recommended Actions</h2>
              <ul role="list" class={css({ display: "grid", gap: "2" })}>
                <For each={b().recommendedActions ?? []}>
                  {(action) => (
                    <li>
                      <RecommendedActionCard action={action} />
                    </li>
                  )}
                </For>
              </ul>
            </Show>

            <Show when={b().loopReport}>
              {(loopReport) => (
                <>
                  <hr class={goldDivider} />
                  <h2 class={sectionLabel}>Loop Report</h2>

                  <h3 class={loopSubheadingClass}>Correspondence movement</h3>
                  <dl
                    class={css({
                      borderBottomWidth: "1px",
                      borderBottomStyle: "solid",
                      borderBottomColor: "zodiac.cream/10",
                      borderTopWidth: "1px",
                      borderTopStyle: "solid",
                      borderTopColor: "zodiac.cream/10",
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

                  <Show when={loopReport().correspondences.countsCapped}>
                    <p class={metaLine}>
                      Counts capped at 1,000 movements per status; displayed
                      totals are lower bounds.
                    </p>
                  </Show>

                  <Show
                    when={loopReport().correspondences.topMovers.length > 0}
                  >
                    <h4 class={loopSubheadingClass}>Top movers</h4>
                    <div
                      class={css({
                        borderTopWidth: "1px",
                        borderTopStyle: "solid",
                        borderTopColor: "zodiac.gold/16",
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

                  <h3 class={loopSubheadingClass}>Review queue</h3>
                  <div
                    class={cx(
                      reviewQueueBannerClass,
                      loopReport().reviewQueue.agentBlocked &&
                        reviewQueueBlockedClass,
                    )}
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

                  <h3 class={loopSubheadingClass}>Experiment debt</h3>
                  <Show
                    when={loopReport().experimentDebt.length > 0}
                    fallback={
                      <p class={css({ color: "zodiac.cream/68" })}>
                        No recipes are waiting on composition or listening.
                      </p>
                    }
                  >
                    <div
                      class={css({
                        borderTopWidth: "1px",
                        borderTopStyle: "solid",
                        borderTopColor: "zodiac.gold/16",
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
                    <h3 class={loopSubheadingClass}>Proposed feeds</h3>
                    <div
                      class={css({
                        borderTopWidth: "1px",
                        borderTopStyle: "solid",
                        borderTopColor: "zodiac.gold/16",
                        display: "grid",
                      })}
                    >
                      <For each={loopReport().proposedFeeds}>
                        {(feed) => {
                          const enabled = () =>
                            enabledFeedIds().has(feed.feedId) ||
                            (liveFeedStates() ?? []).some(
                              (state) =>
                                state.id === feed.feedId && state.enabled,
                            );
                          return (
                            <div
                              class={css({
                                alignItems: { base: "start", md: "center" },
                                borderBottomWidth: "1px",
                                borderBottomStyle: "solid",
                                borderBottomColor: "zodiac.gold/16",
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
                                  rel="noopener noreferrer"
                                  class={cx(
                                    css({
                                      color: "zodiac.cream",
                                      textDecorationColor: "zodiac.gold/45",
                                      textUnderlineOffset: "3px",
                                    }),
                                    focusRingClass,
                                  )}
                                >
                                  {feed.name}
                                  <span class={css({ srOnly: true })}>
                                    {" "}
                                    (opens in a new tab)
                                  </span>
                                </a>
                                <p
                                  class={css({
                                    color: "zodiac.cream/68",
                                    m: "0",
                                    mt: "1",
                                  })}
                                >
                                  {feed.rationale}
                                </p>
                              </div>
                              <UIButton
                                type="button"
                                variant={enabled() ? "ghost" : "outline"}
                                aria-label={
                                  enabled()
                                    ? `${feed.name} enabled`
                                    : `Enable feed ${feed.name}`
                                }
                                aria-busy={enablingFeedId() === feed.feedId}
                                aria-disabled={
                                  enabled() ||
                                  enablingFeedId() === feed.feedId ||
                                  undefined
                                }
                                onClick={() => {
                                  if (enabled()) return;
                                  void handleEnableFeed(feed.feedId, feed.name);
                                }}
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
            <Markdown content={bodyWithoutTitle(b().bodyMd)} />

            {/* Todo Items */}
            <Show when={(b().todo ?? []).length > 0}>
              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Action Items</h2>
              <ul
                class={css({
                  color: "zodiac.cream/70",
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
              <h2 class={sectionLabel}>Active Theses</h2>
              <div class={css({ display: "flex", gap: "2", flexWrap: "wrap" })}>
                <For each={activeTheses()}>
                  {(thesis) => (
                    <Link
                      to="/theses/$thesisId"
                      params={{ thesisId: String(thesis._id) }}
                      class={cx(
                        css({
                          alignItems: "center",
                          display: "inline-flex",
                          minHeight: "6",
                          textDecoration: "none",
                          _coarsePointer: { minHeight: "11" },
                        }),
                        focusRingClass,
                      )}
                    >
                      <UIBadge tone="gold">{thesis.title}</UIBadge>
                    </Link>
                  )}
                </For>
              </div>
            </Show>

            <Show when={referencedFailures().length > 0}>
              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Referenced Reversals</h2>
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={referencedFailures()}>
                  {(failure) => (
                    <Link
                      to="/failures"
                      hash={failure.key}
                      class={cx(
                        css({
                          borderColor: "zodiac.gold/18",
                          borderRadius: "l2",
                          borderWidth: "1px",
                          color: "zodiac.cream/76",
                          display: "block",
                          p: "3",
                          textDecoration: "none",
                        }),
                        focusRingClass,
                      )}
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
              <time datetime={new Date(b().createdAt).toISOString()}>
                {new Date(b().createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
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
