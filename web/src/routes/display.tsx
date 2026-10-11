import { createSignal, For, onMount, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import {
  helperClass,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UINotice,
} from "../components/ui";
import {
  createAction,
  createMutation,
  createQuery,
  createQueryWithStatus,
  describeError,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

const statGridClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "repeat(2, minmax(0, 1fr))",
    md: "repeat(4, minmax(0, 1fr))",
  },
});

/** dt must precede dd in the DOM; the tile still reads value-over-label. */
const statTileClass = css({
  display: "flex",
  flexDirection: "column-reverse",
});

const statLabelClass = css({
  color: "zodiac.cream/66",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
});

function statusTone(status: string): "gold" | "violet" | "cream" {
  if (status === "text_ready") return "violet";
  if (status === "review_needed" || status === "extracted") return "cream";
  return "gold";
}

function confidenceTone(value: string): "gold" | "violet" | "cream" {
  if (value === "high") return "gold";
  if (value === "medium") return "violet";
  return "cream";
}

const DISPLAY_QUEUE_LIMIT = import.meta.env.VITE_E2E_MODE === "1" ? 200 : 24;

const ACTION_QUEUE_HEADING_ID = "display-action-queue-heading";
const mutedTextClass = css({ color: "zodiac.cream/66" });
const clusterMetaClass = css({ color: "zodiac.cream/66", fontSize: "sm" });

/**
 * Where focus goes when `row` is about to leave the queue (or its action is
 * about to be disabled): the first enabled action in the next row, else the
 * previous row, else the Action Queue heading. Never `<body>`.
 */
function focusTargetAfter(row: Element): HTMLElement | null {
  const firstAction = (candidate: Element | null) =>
    candidate?.querySelector<HTMLButtonElement>("button:not(:disabled)") ??
    null;
  return (
    firstAction(row.nextElementSibling) ??
    firstAction(row.previousElementSibling) ??
    document.getElementById(ACTION_QUEUE_HEADING_ID)
  );
}

export function DisplayPage() {
  onMount(() => {
    document.title = "Display Queue — Frequency Music";
  });

  type InboxRow = {
    _id: Id<"sources">;
    status: string;
    type: string;
    title?: string;
    blockedReason?: string;
    canonicalUrl?: string;
    nextAction: string;
    extractionPreview?: {
      summary: string;
      claimPreviews: Array<{
        text: string;
        truthConfidence?: "low" | "medium" | "high";
        interestLevel?: "low" | "medium" | "high";
      }>;
    } | null;
  };

  const inboxRows = createQueryWithStatus(api.inbox.list, () => ({
    limit: DISPLAY_QUEUE_LIMIT,
  }));
  const counts = createQuery(api.inbox.counts);
  const editorialSignals = createQuery(api.dashboard.editorialSignals, () => ({
    limit: 6,
  }));

  const runExtraction = createAction(api.extract.extractSource);
  const updateStatus = createMutation(api.sources.updateStatus);
  const setVisibility = createMutation(api.sources.setVisibility);

  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  // Which row currently has a mutation in flight — its actions stay disabled
  // so a second click cannot submit the same source twice.
  const [pendingRowIds, setPendingRowIds] = createSignal<
    ReadonlySet<Id<"sources">>
  >(new Set());
  const isRowPending = (sourceId: Id<"sources">) =>
    pendingRowIds().has(sourceId);

  async function withRowPending(
    sourceId: Id<"sources">,
    run: () => Promise<void>,
  ) {
    if (isRowPending(sourceId)) return;
    setPendingRowIds((prev) => new Set(prev).add(sourceId));
    setNotice(null);
    setNoticeError(null);
    try {
      await run();
    } finally {
      setPendingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  }

  async function runRowExtraction(
    sourceId: Id<"sources">,
    trigger: HTMLButtonElement,
  ) {
    const row = trigger.closest("[data-testid='display-row']");
    await withRowPending(sourceId, async () => {
      try {
        await runExtraction({ sourceId });
        setNotice("Extraction started.");
      } catch (error) {
        setNoticeError(`Extraction failed: ${describeError(error)}`);
      }
    });
    // A finished extraction moves the source past text_ready, which disables
    // this button; keep focus inside the queue instead of on <body>.
    // Chromium drops focus to <body> the moment a focused button disables.
    const focusLost =
      document.activeElement === trigger ||
      document.activeElement === document.body;
    if (focusLost && trigger.disabled && row?.isConnected) {
      (
        row.querySelector<HTMLButtonElement>("button:not(:disabled)") ??
        focusTargetAfter(row)
      )?.focus();
    }
  }

  /**
   * Runs a mutation that removes the row from the queue. Focus moves to a
   * stable neighbour before the row unmounts, and returns to the trigger if
   * the mutation fails and the row stays.
   */
  async function runRowRemoval(
    sourceId: Id<"sources">,
    trigger: HTMLButtonElement,
    mutate: () => Promise<unknown>,
    success: string,
    failure: string,
  ) {
    if (isRowPending(sourceId)) return;
    const row = trigger.closest("[data-testid='display-row']");
    if (row) focusTargetAfter(row)?.focus();
    await withRowPending(sourceId, async () => {
      try {
        await mutate();
        setNotice(success);
      } catch (error) {
        setNoticeError(`${failure}: ${describeError(error)}`);
        if (trigger.isConnected) trigger.focus();
      }
    });
  }

  function markTriaged(sourceId: Id<"sources">, trigger: HTMLButtonElement) {
    return runRowRemoval(
      sourceId,
      trigger,
      () =>
        updateStatus({
          id: sourceId,
          status: "triaged" as const,
        }),
      "Source marked as triaged.",
      "Status update failed",
    );
  }

  function promoteFollowers(
    sourceId: Id<"sources">,
    trigger: HTMLButtonElement,
  ) {
    return runRowRemoval(
      sourceId,
      trigger,
      () =>
        setVisibility({
          id: sourceId,
          visibility: "followers",
        }),
      "Visibility promoted to followers.",
      "Promotion failed",
    );
  }

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Display & Triage</h1>
        <p class={helperClass}>
          This queue prioritizes blocked and oldest private sources so weekly
          review stays aligned with ingest throughput.
        </p>
        <UINotice
          class={css({ marginTop: "3" })}
          status={notice()}
          error={noticeError()}
        />
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Inbox Totals</h2>
        <dl class={statGridClass}>
          <div class={statTileClass}>
            <dt class={statLabelClass}>Ingested</dt>
            <dd class={css({ color: "zodiac.gold", fontSize: "3xl" })}>
              {counts()?.ingested ?? 0}
            </dd>
          </div>
          <div class={statTileClass}>
            <dt class={statLabelClass}>Text Ready</dt>
            <dd class={css({ color: "zodiac.violet", fontSize: "3xl" })}>
              {counts()?.textReady ?? 0}
            </dd>
          </div>
          <div class={statTileClass}>
            <dt class={statLabelClass}>Review Needed</dt>
            <dd class={css({ color: "zodiac.cream", fontSize: "3xl" })}>
              {counts()?.reviewNeeded ?? 0}
            </dd>
          </div>
          <div class={statTileClass}>
            <dt class={statLabelClass}>Blocked</dt>
            <dd class={css({ color: "zodiac.error", fontSize: "3xl" })}>
              {counts()?.blocked ?? 0}
            </dd>
          </div>
        </dl>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Editorial Signals</h2>
        <p class={cx(helperClass, css({ mb: "3" }))}>
          These concept areas combine hypothesis outcomes, downstream recipes,
          compositions, and listening verdicts into a pragmatic yield score.
        </p>
        <div
          class={css({
            display: "grid",
            gap: "4",
            gridTemplateColumns: {
              base: "minmax(0, 1fr)",
              md: "repeat(2, minmax(0, 1fr))",
            },
          })}
        >
          <div>
            <h3 class={css({ color: "zodiac.gold", fontSize: "sm", mb: "2" })}>
              High-yield areas
            </h3>
            <Show
              when={(editorialSignals()?.highYieldClusters ?? []).length > 0}
              fallback={
                <p class={mutedTextClass}>No high-yield clusters yet.</p>
              }
            >
              <For each={editorialSignals()?.highYieldClusters ?? []}>
                {(cluster) => (
                  <div class={css({ mb: "2" })}>
                    <div class={css({ color: "zodiac.cream" })}>
                      {cluster.domain}
                    </div>
                    <div class={clusterMetaClass}>
                      {cluster.conceptNames.join(", ")} · score {cluster.score}
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
          <div>
            <h3 class={css({ color: "zodiac.gold", fontSize: "sm", mb: "2" })}>
              Low-yield areas
            </h3>
            <Show
              when={(editorialSignals()?.lowYieldClusters ?? []).length > 0}
              fallback={
                <p class={mutedTextClass}>No low-yield clusters yet.</p>
              }
            >
              <For each={editorialSignals()?.lowYieldClusters ?? []}>
                {(cluster) => (
                  <div class={css({ mb: "2" })}>
                    <div class={css({ color: "zodiac.cream" })}>
                      {cluster.domain}
                    </div>
                    <div class={clusterMetaClass}>
                      {cluster.conceptNames.join(", ")} · score {cluster.score}
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </UICard>

      <UICard>
        <h2
          id={ACTION_QUEUE_HEADING_ID}
          tabIndex={-1}
          class={sectionTitleClass}
        >
          Action Queue
        </h2>

        <UINotice
          status={
            inboxRows.isLoading()
              ? "Loading inbox…"
              : !inboxRows.error() && (inboxRows.data() ?? []).length === 0
                ? "No sources need action right now."
                : null
          }
          error={
            inboxRows.error()
              ? `Unable to load the inbox: ${inboxRows.error()?.message}`
              : null
          }
        />
        <Show when={!inboxRows.isLoading()}>
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={inboxRows.data() ?? []}>
              {(row: InboxRow) => (
                <div
                  data-testid="display-row"
                  class={css({
                    borderColor: "zodiac.gold/24",
                    borderRadius: "l2",
                    borderWidth: "1px",
                    p: "4",
                  })}
                >
                  <div
                    class={css({
                      alignItems: "center",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "2",
                      marginBottom: "2",
                    })}
                  >
                    <UIBadge tone={statusTone(row.status)}>
                      {row.status}
                    </UIBadge>
                    <UIBadge tone="cream">{row.type}</UIBadge>
                    <Show when={row.blockedReason}>
                      <UIBadge tone="cream">
                        blocked: {row.blockedReason}
                      </UIBadge>
                    </Show>
                  </div>

                  <h3 class={css({ fontSize: "xl", marginBottom: "1" })}>
                    {row.title ?? "Untitled source"}
                  </h3>
                  <p
                    class={css({
                      color: "zodiac.cream/66",
                      fontSize: "sm",
                      marginBottom: "2",
                    })}
                  >
                    Next action: <strong>{row.nextAction}</strong>
                  </p>

                  <Show when={row.extractionPreview}>
                    {(preview) => (
                      <div class={css({ marginBottom: "2" })}>
                        <p
                          class={css({
                            color: "zodiac.cream/66",
                            maxW: "72ch",
                            fontSize: "sm",
                            marginBottom: "2",
                          })}
                        >
                          {preview().summary}
                        </p>
                        <Show when={preview().claimPreviews.length > 0}>
                          <div class={css({ display: "grid", gap: "2" })}>
                            <For each={preview().claimPreviews}>
                              {(claim) => (
                                <div
                                  class={css({
                                    bg: "zodiac.cream/2",
                                    borderColor: "zodiac.gold/16",
                                    borderRadius: "l2",
                                    borderWidth: "1px",
                                    p: "2.5",
                                  })}
                                >
                                  <p
                                    class={css({
                                      color: "zodiac.cream/68",
                                      maxW: "72ch",
                                      fontSize: "sm",
                                      marginBottom: "2",
                                    })}
                                  >
                                    {claim.text}
                                  </p>
                                  <div
                                    class={css({
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "2",
                                    })}
                                  >
                                    <Show when={claim.truthConfidence}>
                                      {(value) => (
                                        <UIBadge tone={confidenceTone(value())}>
                                          truth: {value()}
                                        </UIBadge>
                                      )}
                                    </Show>
                                    <Show when={claim.interestLevel}>
                                      {(value) => (
                                        <UIBadge tone={confidenceTone(value())}>
                                          interest: {value()}
                                        </UIBadge>
                                      )}
                                    </Show>
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    )}
                  </Show>

                  <div
                    class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}
                  >
                    {/* aria-busy, not disabled, while a row action is in
                        flight: disabling the pressed button would blur it.
                        withRowPending ignores repeat presses. */}
                    <UIButton
                      variant="outline"
                      disabled={row.status !== "text_ready"}
                      aria-busy={isRowPending(row._id)}
                      aria-label={`Run extraction for ${row.title ?? "Untitled source"}`}
                      onClick={(event) =>
                        runRowExtraction(row._id, event.currentTarget)
                      }
                    >
                      Run Extraction
                    </UIButton>
                    <UIButton
                      variant="outline"
                      aria-busy={isRowPending(row._id)}
                      aria-label={`Mark ${row.title ?? "Untitled source"} as triaged`}
                      onClick={(event) =>
                        markTriaged(row._id, event.currentTarget)
                      }
                    >
                      Mark Triaged
                    </UIButton>
                    <UIButton
                      variant="ghost"
                      aria-busy={isRowPending(row._id)}
                      aria-label={`Promote ${row.title ?? "Untitled source"} to followers`}
                      onClick={(event) =>
                        promoteFollowers(row._id, event.currentTarget)
                      }
                    >
                      Promote Followers
                    </UIButton>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </UICard>
    </section>
  );
}
