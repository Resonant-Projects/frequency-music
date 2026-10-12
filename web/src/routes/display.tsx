import { createSignal, For, onMount, Show } from "solid-js";
import { createKeyedRows } from "../lib/keyed-rows";
import type { Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import { StatTiles } from "../components/stat-tiles";
import {
  badgeRowClass,
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
import {
  needsSourceText,
  SourceRecovery,
  type RecoverySource,
} from "../components/source-recovery";

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
const clusterHeadingClass = css({
  color: "zodiac.gold",
  fontSize: "sm",
  mb: "2",
});
const clusterClass = css({ mb: "2" });
const clusterDomainClass = css({ color: "zodiac.cream" });
const helperSpacedClass = cx(helperClass, css({ mb: "2" }));
const rowClass = css({
  borderColor: "zodiac.gold/24",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "4",
  "& button": { minBlockSize: "11" },
});
const rowBadgesClass = cx(badgeRowClass, css({ mb: "2" }));
const rowTitleClass = css({ fontSize: "xl", marginBottom: "1" });
const claimClass = css({
  bg: "zodiac.cream/2",
  borderColor: "zodiac.gold/16",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "2.5",
});
const claimTextClass = css({
  color: "zodiac.cream/68",
  maxW: "72ch",
  fontSize: "sm",
  marginBottom: "2",
});
const stackClass = css({ display: "grid", gap: "2" });

/**
 * Where focus goes when `row` is about to leave the queue (or its action is
 * about to be disabled): the first enabled action in the next row, else the
 * previous row, else the Action Queue heading. Never `<body>`.
 */
function focusTargetAfter(row: Element): HTMLElement | null {
  // A busy control may disable itself when its own action lands, which would
  // drop the focus we just handed it; skip those too.
  const firstAction = (candidate: Element | null) =>
    candidate?.querySelector<HTMLButtonElement>(
      'button:not(:disabled):not([aria-busy="true"])',
    ) ?? null;
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

  type InboxRow = RecoverySource & {
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
  // Rows keyed by id so a refresh after Mark Triaged / Promote Followers
  // keeps the neighbouring row (and the focus handed to it) mounted.
  const inboxRowList = createKeyedRows<InboxRow>(
    () => inboxRows.data(),
    (row) => row._id,
  );
  const counts = createQuery(api.inbox.counts);
  const editorialSignals = createQuery(api.dashboard.editorialSignals, () => ({
    limit: 6,
  }));

  const runExtraction = createAction(api.extract.extractSource);
  const updateStatus = createMutation(api.sources.updateStatus);
  const archiveRecovery = createMutation(api.sources.archiveRecoverySource);
  const setVisibility = createMutation(api.sources.setVisibility);

  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  // Which row currently has a mutation in flight — its actions stay disabled
  // so a second click cannot submit the same source twice.
  const [pendingRowIds, setPendingRowIds] = createSignal<ReadonlySet<string>>(
    new Set(),
  );
  const isRowPending = (sourceId: Id<"sources">) =>
    pendingRowIds().has(sourceId);

  function setRowPending(sourceId: string, pending: boolean) {
    setPendingRowIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(sourceId);
      else next.delete(sourceId);
      return next;
    });
  }

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
    if (isRowPending(sourceId)) return;
    // A started extraction moves the source past text_ready, which disables
    // this button — and the live query can push that status before the
    // action resolves. Chromium drops focus to <body> the moment a focused
    // button disables, so hand focus to a stable queue target first: the
    // row's next enabled action, else a neighbouring row, else the heading.
    const row = trigger.closest("[data-testid='display-row']");
    const target =
      row?.querySelector<HTMLButtonElement>(
        'button:not(:disabled):not([aria-busy="true"]):not([aria-label^="Run extraction"])',
      ) ?? (row ? focusTargetAfter(row) : null);
    target?.focus();
    await withRowPending(sourceId, async () => {
      try {
        await runExtraction({ sourceId });
        setNotice("Extraction started.");
      } catch (error) {
        setNoticeError(`Extraction failed: ${describeError(error)}`);
        // The button stays enabled on failure; give it focus back.
        if (trigger.isConnected && !trigger.disabled) trigger.focus();
      }
    });
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
          Recover missing text, resolve access, and review private sources.
          Blocked sources appear first; this page shows up to 24 sources from
          the larger backlog.
        </p>
        <UINotice
          class={css({ marginTop: "3" })}
          status={notice()}
          error={noticeError()}
        />
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Inbox Totals</h2>
        <StatTiles
          items={[
            {
              label: "Ingested",
              value: counts()?.ingested ?? 0,
              tone: "gold",
            },
            {
              label: "Text Ready",
              value: counts()?.textReady ?? 0,
              tone: "violet",
            },
            {
              label: "Review Needed",
              value: counts()?.reviewNeeded ?? 0,
              tone: "cream",
            },
            {
              label: "Blocked",
              value: counts()?.blocked ?? 0,
              tone: "error",
            },
          ]}
        />
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
            <h3 class={clusterHeadingClass}>High-yield areas</h3>
            <Show
              when={(editorialSignals()?.highYieldClusters ?? []).length > 0}
              fallback={<p class={helperClass}>No high-yield clusters yet.</p>}
            >
              <For each={editorialSignals()?.highYieldClusters ?? []}>
                {(cluster) => (
                  <div class={clusterClass}>
                    <div class={clusterDomainClass}>{cluster.domain}</div>
                    <div class={helperClass}>
                      {cluster.conceptNames.join(", ")} · score {cluster.score}
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
          <div>
            <h3 class={clusterHeadingClass}>Low-yield areas</h3>
            <Show
              when={(editorialSignals()?.lowYieldClusters ?? []).length > 0}
              fallback={<p class={helperClass}>No low-yield clusters yet.</p>}
            >
              <For each={editorialSignals()?.lowYieldClusters ?? []}>
                {(cluster) => (
                  <div class={clusterClass}>
                    <div class={clusterDomainClass}>{cluster.domain}</div>
                    <div class={helperClass}>
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
            <For each={inboxRowList.ids()}>
              {(id) => (
                <Show when={inboxRowList.byId().get(id)}>
                  {(row) => (
                    <div data-testid="display-row" class={rowClass}>
                      <div class={rowBadgesClass}>
                        <UIBadge tone={statusTone(row().status)}>
                          {row().status}
                        </UIBadge>
                        <UIBadge tone="cream">{row().type}</UIBadge>
                        <Show when={row().blockedReason}>
                          <UIBadge tone="cream">
                            blocked: {row().blockedReason}
                          </UIBadge>
                        </Show>
                      </div>

                      <h3
                        id={`source-title-${row()._id}`}
                        tabIndex={-1}
                        class={rowTitleClass}
                      >
                        {row().title ?? "Untitled source"}
                      </h3>
                      <p class={helperSpacedClass}>
                        Next action:{" "}
                        <strong>
                          {needsSourceText(row())
                            ? "Provide source text or update access"
                            : row().nextAction}
                        </strong>
                      </p>

                      <SourceRecovery
                        source={row()}
                        pending={isRowPending(row()._id)}
                        onPending={(pending) => setRowPending(id, pending)}
                        onNotice={(message) => {
                          setNoticeError(null);
                          setNotice(message);
                        }}
                      />

                      <Show when={row().extractionPreview}>
                        {(preview) => (
                          <div class={clusterClass}>
                            <p class={helperSpacedClass}>{preview().summary}</p>
                            <Show when={preview().claimPreviews.length > 0}>
                              <div class={stackClass}>
                                <For each={preview().claimPreviews}>
                                  {(claim) => (
                                    <div class={claimClass}>
                                      <p class={claimTextClass}>{claim.text}</p>
                                      <div class={badgeRowClass}>
                                        <Show when={claim.truthConfidence}>
                                          {(value) => (
                                            <UIBadge
                                              tone={confidenceTone(value())}
                                            >
                                              truth: {value()}
                                            </UIBadge>
                                          )}
                                        </Show>
                                        <Show when={claim.interestLevel}>
                                          {(value) => (
                                            <UIBadge
                                              tone={confidenceTone(value())}
                                            >
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

                      <div class={badgeRowClass}>
                        {/* aria-busy, not disabled, while a row action is in
                        flight: disabling the pressed button would blur it.
                        withRowPending ignores repeat presses. */}
                        <Show when={!needsSourceText(row())}>
                          <UIButton
                            variant="outline"
                            disabled={row().status !== "text_ready"}
                            aria-busy={isRowPending(row()._id)}
                            aria-label={`Run extraction for ${row().title ?? "Untitled source"}`}
                            onClick={(event) =>
                              runRowExtraction(row()._id, event.currentTarget)
                            }
                          >
                            Run Extraction
                          </UIButton>
                        </Show>
                        <Show when={!needsSourceText(row())}>
                          <UIButton
                            variant="outline"
                            aria-busy={isRowPending(row()._id)}
                            aria-label={`Mark ${row().title ?? "Untitled source"} as triaged`}
                            onClick={(event) =>
                              markTriaged(row()._id, event.currentTarget)
                            }
                          >
                            Mark Triaged
                          </UIButton>
                          <UIButton
                            variant="ghost"
                            aria-busy={isRowPending(row()._id)}
                            aria-label={`Promote ${row().title ?? "Untitled source"} to followers`}
                            onClick={(event) =>
                              promoteFollowers(row()._id, event.currentTarget)
                            }
                          >
                            Promote Followers
                          </UIButton>
                        </Show>
                        <Show when={needsSourceText(row())}>
                          <UIButton
                            variant="ghost"
                            class={css({ minBlockSize: "11" })}
                            aria-busy={isRowPending(row()._id)}
                            aria-label={`Archive ${row().title ?? "Untitled source"}`}
                            onClick={(event) =>
                              runRowRemoval(
                                row()._id,
                                event.currentTarget,
                                () =>
                                  archiveRecovery({
                                    id: row()._id,
                                    expectedUpdatedAt: row().updatedAt,
                                  }),
                                "Source archived privately. Its text and failure evidence have been retained.",
                                "Archive failed",
                              )
                            }
                          >
                            Archive
                          </UIButton>
                          <span class={helperClass}>
                            Remove from the queue and retain the private source.
                          </span>
                        </Show>
                      </div>
                    </div>
                  )}
                </Show>
              )}
            </For>
          </div>
        </Show>
      </UICard>
    </section>
  );
}
