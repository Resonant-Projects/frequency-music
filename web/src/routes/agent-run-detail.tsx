import { Link, useParams } from "@tanstack/solid-router";
import { createMemo, createSignal, For, Index, onMount, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import {
  DecisionState,
  DraftPayloadPreview,
  draftLabel,
  type PersistedReviewDraft,
} from "../components/agent-draft";
import {
  AgentRunEventList,
  AgentRunTimesList,
} from "../components/agent-run-event";
import {
  backLink,
  badgeRowClass,
  DateTime,
  detailTitleClass,
  fieldLabelClass,
  focusRingClass,
  helperClass,
  inlineActionLink,
  metaLine,
  pageClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIList,
  UINotice,
  UITextarea,
} from "../components/ui";
import {
  createMutation,
  createQueryWithStatus,
  describeError,
  describeLoad,
} from "../integrations/convex";
import { runStatusTone } from "../lib/agent-run-format";
import { api } from "../../../convex/_generated/api";

type PublicReviewDraft = {
  kind: "dry_run_summary" | "hypothesis_draft" | "recipe_draft";
  title: string;
  summary: string;
  candidateIds: string[];
  needsReview: boolean;
};
type PublicAgentRun = Omit<Doc<"agentRuns">, "input"> & {
  smokeMode?: boolean;
  reviewDraft?: PublicReviewDraft;
};

const sectionStackClass = css({ display: "grid", gap: "4" });

const draftItemClass = css({
  borderColor: "zodiac.cream/12",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "grid",
  gap: "3",
  minW: "0",
  p: "4",
});

const stackClass = css({ display: "grid", gap: "3" });

const draftActionsClass = css({ display: "grid", gap: "2" });

const draftHeaderClass = cx(
  badgeRowClass,
  css({ justifyContent: "space-between" }),
);

/** Badge row under a field label. */
const labelledBadgeRowClass = cx(badgeRowClass, css({ mt: "2" }));

const reviewDraftTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: "2xl",
  lineHeight: "1.2",
});

const persistedDraftTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: "xl",
  lineHeight: "1.2",
});

/** Id of a persisted draft's title, the focus target once it is decided. */
function draftTitleId(draft: PersistedReviewDraft) {
  return `persisted-draft-title-${draft._id}`;
}

/** Per-draft approve/reject controls for a persisted human-review draft. */
function PersistedDraftActions(props: {
  draft: PersistedReviewDraft;
  /** A heading that outlives the controls, focused once a decision lands. */
  focusTargetId: string;
  /** Announces a decision from a region that outlives this component. */
  onDecided: (message: string) => void;
}) {
  const approve = createMutation(api.agentDrafts.approve);
  const reject = createMutation(api.agentDrafts.reject);

  const [note, setNote] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const canReject = createMemo(() => note().trim().length > 0);
  const canPromote = createMemo(() => Boolean(props.draft.payload));

  // A decision swaps these controls for <DecisionState>, unmounting the
  // focused button. Convex pushes the status update before the mutation
  // promise resolves, so focus moves to the draft's title BEFORE the call;
  // a failure hands it back to the button, which is still mounted.
  function focusDraftTitle() {
    document.getElementById(props.focusTargetId)?.focus();
  }

  async function decide(
    trigger: HTMLButtonElement,
    run: () => Promise<unknown>,
    verb: "Approved" | "Rejected",
  ) {
    setError(null);
    setBusy(true);
    focusDraftTitle();
    try {
      await run();
      props.onDecided(`${verb} draft: ${props.draft.title}.`);
    } catch (err) {
      setError(
        `Failed to ${verb === "Approved" ? "approve" : "reject"} draft: ${describeError(err)}`,
      );
      if (trigger.isConnected) trigger.focus();
    } finally {
      setBusy(false);
    }
  }

  function handleApprove(
    event: MouseEvent & { currentTarget: HTMLButtonElement },
  ) {
    if (busy() || !canPromote()) return;
    void decide(
      event.currentTarget,
      () =>
        approve({
          draftId: props.draft._id,
          ...(note().trim() ? { decisionNote: note().trim() } : {}),
        }),
      "Approved",
    );
  }

  function handleReject(
    event: MouseEvent & { currentTarget: HTMLButtonElement },
  ) {
    if (busy() || !canReject()) return;
    void decide(
      event.currentTarget,
      () => reject({ draftId: props.draft._id, decisionNote: note().trim() }),
      "Rejected",
    );
  }

  return (
    <>
      <UINotice error={error()} />
      <Show
        when={props.draft.status === "pending_review"}
        fallback={<DecisionState draft={props.draft} />}
      >
        <div class={draftActionsClass}>
          <label class={fieldLabelClass} for={`note-${props.draft._id}`}>
            Decision Note (required to reject)
          </label>
          <UITextarea
            id={`note-${props.draft._id}`}
            value={note()}
            onInput={(event) => setNote(event.currentTarget.value)}
            placeholder="Why approve or reject? A note is required to reject."
          />
          <Show when={!canPromote()}>
            <p class={helperClass}>
              This draft has no structured payload, so it cannot be promoted. It
              can only be rejected with a note.
            </p>
          </Show>
          <div class={badgeRowClass}>
            {/* aria-busy plus the in-flight guard, not `disabled`: disabling
                the activated button would blur it before the swap. */}
            <UIButton
              variant="outline"
              disabled={!canPromote()}
              aria-busy={busy()}
              aria-label={`Approve draft: ${props.draft.title}`}
              onClick={handleApprove}
            >
              {busy() ? "Working…" : "Approve"}
            </UIButton>
            <UIButton
              variant="outline"
              disabled={!canReject()}
              aria-busy={busy()}
              aria-label={`Reject draft: ${props.draft.title}`}
              onClick={handleReject}
            >
              Reject
            </UIButton>
          </div>
        </div>
      </Show>
    </>
  );
}

export function AgentRunDetailPage() {
  const params = useParams({ from: "/agent-runs/$runId" });
  const runId = createMemo(() => params().runId as Id<"agentRuns">);

  const run = createQueryWithStatus(api.agentRuns.getPublic, () => ({
    runId: runId(),
  }));
  const events = createQueryWithStatus(api.agentRuns.listEventsPublic, () => ({
    runId: runId(),
    limit: 120,
  }));
  const persistedDrafts = createQueryWithStatus(
    api.agentDrafts.listByRun,
    () => ({
      agentRunId: runId(),
      limit: 10,
    }),
  );

  onMount(() => {
    document.title = "Agent Run — Frequency Music";
  });

  const runRow = () => run.data() as PublicAgentRun | null | undefined;
  const [draftDecision, setDraftDecision] = createSignal<string | null>(null);

  const runLoad = describeLoad(run, "agent run");
  const persistedDraftsError = () =>
    persistedDrafts.error()
      ? `Unable to load persisted drafts: ${persistedDrafts.error()?.message}`
      : null;
  const persistedDraftsStatus = () => {
    if (persistedDrafts.isLoading()) return "Loading persisted drafts...";
    if (persistedDrafts.error() || (persistedDrafts.data() ?? []).length > 0) {
      return null;
    }
    return "No persisted human-review draft rows are linked to this run yet.";
  };
  const eventsError = () =>
    events.error() ? `Unable to load events: ${events.error()?.message}` : null;
  const eventsStatus = () => {
    if (events.isLoading()) return "Loading events...";
    if (events.error() || (events.data() ?? []).length > 0) return null;
    return "No events recorded for this run.";
  };

  return (
    <section class={pageClass}>
      <div>
        <Link to="/agent-runs" class={backLink}>
          <span aria-hidden="true">&larr;</span> Agent Runs
        </Link>
      </div>

      <UICard>
        <UINotice status={runLoad.status()} error={runLoad.error()} />
        <Show when={runRow()}>
          {(row) => (
            <>
              <div class={cx(badgeRowClass, css({ mb: "3" }))}>
                <UIBadge tone={runStatusTone(row().status)}>
                  {row().status}
                </UIBadge>
                <UIBadge tone="cream">{row().graphName}</UIBadge>
                <Show when={row().smokeMode}>
                  <UIBadge tone="cream">Smoke</UIBadge>
                </Show>
              </div>
              <h1 class={detailTitleClass}>
                Agent Run {String(row()._id).slice(0, 12)}
              </h1>
              <p class={helperClass}>
                {row().summary ?? "This run has not recorded a summary yet."}
              </p>
              <AgentRunTimesList run={row()} class={css({ mt: "4" })} />
              <Show when={row().traceUrl}>
                {(traceUrl) => (
                  <a
                    class={cx(inlineActionLink, css({ mt: "4" }))}
                    href={traceUrl()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open LangSmith Trace <span aria-hidden="true">↗</span>
                  </a>
                )}
              </Show>
            </>
          )}
        </Show>
      </UICard>

      <Show when={runRow()}>
        {(row) => (
          <>
            <UICard>
              <h2 class={sectionTitleClass}>Review Draft</h2>
              <Show
                when={row().reviewDraft}
                fallback={
                  <p class={helperClass}>
                    No sanitized review draft has been attached to this run yet.
                  </p>
                }
              >
                {(draft) => (
                  <div class={sectionStackClass}>
                    <div class={badgeRowClass}>
                      <UIBadge tone="gold">{draftLabel(draft().kind)}</UIBadge>
                      <UIBadge tone={draft().needsReview ? "violet" : "cream"}>
                        {draft().needsReview ? "Needs Review" : "Read Only"}
                      </UIBadge>
                    </div>
                    <h3 class={reviewDraftTitleClass}>{draft().title}</h3>
                    <p class={helperClass}>{draft().summary}</p>
                    <div>
                      <div class={fieldLabelClass}>Candidate IDs</div>
                      <div class={labelledBadgeRowClass}>
                        <For each={draft().candidateIds}>
                          {(candidateId) => (
                            <UIBadge tone="cream">{candidateId}</UIBadge>
                          )}
                        </For>
                      </div>
                    </div>
                    <p class={helperClass}>
                      This is the sanitized in-run snapshot. Approve or reject
                      the promotable record in Persisted Draft Records below (or
                      from the Review Queue).
                    </p>
                  </div>
                )}
              </Show>
            </UICard>

            <UICard>
              <h2 class={sectionTitleClass}>Persisted Draft Records</h2>
              <UINotice
                status={persistedDraftsStatus() ?? draftDecision()}
                error={persistedDraftsError()}
              />
              <Show
                when={
                  !persistedDrafts.isLoading() &&
                  (persistedDrafts.data() ?? []).length > 0
                }
              >
                <UIList class={sectionStackClass}>
                  {/* <Index>, not <For>: every live update hands back fresh
                      objects, and <For> would rebuild each row, dropping focus
                      and any half-written decision note. */}
                  <Index
                    each={
                      (persistedDrafts.data() ?? []) as PersistedReviewDraft[]
                    }
                  >
                    {(draft) => (
                      <li class={draftItemClass}>
                        <article
                          aria-labelledby={draftTitleId(draft())}
                          class={stackClass}
                        >
                          <div class={draftHeaderClass}>
                            <div class={badgeRowClass}>
                              <UIBadge tone="gold">
                                {draftLabel(draft().kind)}
                              </UIBadge>
                              <UIBadge
                                tone={
                                  draft().status === "pending_review"
                                    ? "violet"
                                    : "cream"
                                }
                              >
                                {draft().status}
                              </UIBadge>
                            </div>
                            <DateTime
                              format="datetime"
                              class={metaLine}
                              value={draft().createdAt}
                            />
                          </div>
                          <h3
                            id={draftTitleId(draft())}
                            tabIndex={-1}
                            class={cx(persistedDraftTitleClass, focusRingClass)}
                          >
                            {draft().title}
                          </h3>
                          <p class={helperClass}>{draft().summary}</p>
                          <DraftPayloadPreview
                            kind={draft().kind}
                            payload={draft().payload}
                          />
                          <div>
                            <div class={fieldLabelClass}>Draft Row</div>
                            <span class={metaLine}>{String(draft()._id)}</span>
                          </div>
                          <div>
                            <div class={fieldLabelClass}>Candidate IDs</div>
                            <div class={labelledBadgeRowClass}>
                              <For each={draft().candidateIds}>
                                {(candidateId) => (
                                  <UIBadge tone="cream">{candidateId}</UIBadge>
                                )}
                              </For>
                            </div>
                          </div>
                          <PersistedDraftActions
                            draft={draft()}
                            focusTargetId={draftTitleId(draft())}
                            onDecided={setDraftDecision}
                          />
                        </article>
                      </li>
                    )}
                  </Index>
                </UIList>
              </Show>
            </UICard>

            <UICard>
              <h2 class={sectionTitleClass}>Event Timeline</h2>
              <UINotice status={eventsStatus()} error={eventsError()} />
              <Show
                when={!events.isLoading() && (events.data() ?? []).length > 0}
              >
                <AgentRunEventList
                  events={(events.data() ?? []) as Doc<"agentRunEvents">[]}
                />
              </Show>
            </UICard>
          </>
        )}
      </Show>
    </section>
  );
}
