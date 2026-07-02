import { Link, useParams } from "@tanstack/solid-router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  DecisionState,
  DraftPayloadPreview,
  draftLabel as persistedDraftLabel,
  type PersistedReviewDraft,
} from "../components/agent-draft";
import {
  backLink,
  detailTitleClass,
  fieldLabelClass,
  pageClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UITextarea,
} from "../components/ui";
import { createMutation, createQueryWithStatus } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

type AgentRunStatus = Doc<"agentRuns">["status"];
type AgentRunEventKind = Doc<"agentRunEvents">["kind"];
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

const helperClass = css({
  color: "rgba(245, 240, 232, 0.62)",
  lineHeight: "1.6",
});

const monoClass = css({
  color: "rgba(245, 240, 232, 0.62)",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

const eventClass = css({
  borderColor: "rgba(245, 240, 232, 0.12)",
  borderLeftWidth: "1px",
  display: "grid",
  gap: "2",
  pl: "4",
  position: "relative",
  _before: {
    bg: "zodiac.gold",
    borderRadius: "full",
    content: '""',
    height: "2",
    left: "-1",
    position: "absolute",
    top: "2",
    width: "2",
  },
});

function statusTone(status: AgentRunStatus): "gold" | "violet" | "cream" {
  if (status === "failed") return "violet";
  if (status === "completed") return "gold";
  return "cream";
}

function eventTone(kind: AgentRunEventKind): "gold" | "violet" | "cream" {
  if (kind === "error") return "violet";
  if (kind === "decision" || kind === "review_request") return "gold";
  return "cream";
}

function formatTime(value?: number) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDuration(
  run: Pick<
    PublicAgentRun,
    "createdAt" | "startedAt" | "finishedAt" | "updatedAt"
  >,
) {
  const start = run.startedAt ?? run.createdAt;
  const end = run.finishedAt ?? run.updatedAt;
  const durationMs = Math.max(0, end - start);
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function formatPayload(payload: unknown) {
  if (payload === undefined || payload === null) return "";
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

const draftLabel = persistedDraftLabel;

/** Per-draft approve/reject controls for a persisted human-review draft. */
function PersistedDraftActions(props: { draft: PersistedReviewDraft }) {
  const approve = createMutation(convexApi.agentDrafts.approve);
  const reject = createMutation(convexApi.agentDrafts.reject);

  const [note, setNote] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const canReject = createMemo(() => note().trim().length > 0);
  const canPromote = createMemo(() => Boolean(props.draft.payload));

  async function handleApprove() {
    setError(null);
    setBusy(true);
    try {
      await approve({
        draftId: props.draft._id,
        ...(note().trim() ? { decisionNote: note().trim() } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve draft.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!canReject()) return;
    setError(null);
    setBusy(true);
    try {
      await reject({ draftId: props.draft._id, decisionNote: note().trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject draft.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show
      when={props.draft.status === "pending_review"}
      fallback={<DecisionState draft={props.draft} />}
    >
      <div class={css({ display: "grid", gap: "2" })}>
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
        <Show when={error()}>
          {(message) => (
            <p class={css({ color: "zodiac.violet", lineHeight: "1.6" })}>
              {message()}
            </p>
          )}
        </Show>
        <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
          <UIButton
            variant="solid"
            disabled={busy() || !canPromote()}
            onClick={handleApprove}
          >
            {busy() ? "Working…" : "Approve"}
          </UIButton>
          <UIButton
            variant="outline"
            disabled={busy() || !canReject()}
            onClick={handleReject}
          >
            Reject
          </UIButton>
        </div>
      </div>
    </Show>
  );
}

export function AgentRunDetailPage() {
  const params = useParams({ from: "/agent-runs/$runId" });
  const runId = createMemo(() => params().runId as Id<"agentRuns">);

  const run = createQueryWithStatus(convexApi.agentRuns.getPublic, () => ({
    runId: runId(),
  }));
  const events = createQueryWithStatus(convexApi.agentRuns.listEvents, () => ({
    runId: runId(),
    limit: 120,
  }));
  const persistedDrafts = createQueryWithStatus(
    convexApi.agentDrafts.listByRun,
    () => ({
      agentRunId: runId(),
      limit: 10,
    }),
  );

  onMount(() => {
    document.title = "Agent Run — Frequency Music";
  });

  return (
    <section class={pageClass}>
      <div>
        <Link to="/agent-runs" class={backLink}>
          <span aria-hidden="true">&larr;</span> Agent Runs
        </Link>
      </div>

      <Show
        when={run.data() as PublicAgentRun | null | undefined}
        fallback={
          <UICard>
            <Show
              when={!run.isLoading() && run.error()}
              fallback={<p class={helperClass}>Loading agent run...</p>}
            >
              {(error) => (
                <p class={helperClass}>
                  Unable to load agent run: {error().message}
                </p>
              )}
            </Show>
          </UICard>
        }
      >
        {(row) => (
          <>
            <UICard>
              <div
                class={css({
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "2",
                  mb: "3",
                })}
              >
                <UIBadge tone={statusTone(row().status)}>
                  {row().status}
                </UIBadge>
                <UIBadge tone="violet">{row().graphName}</UIBadge>
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
              <dl
                class={css({
                  display: "grid",
                  gap: "2",
                  gridTemplateColumns: "auto 1fr",
                  mt: "4",
                })}
              >
                <dt class={monoClass}>Created</dt>
                <dd class={helperClass}>{formatTime(row().createdAt)}</dd>
                <dt class={monoClass}>Started</dt>
                <dd class={helperClass}>{formatTime(row().startedAt)}</dd>
                <dt class={monoClass}>Finished</dt>
                <dd class={helperClass}>{formatTime(row().finishedAt)}</dd>
                <dt class={monoClass}>Duration</dt>
                <dd class={helperClass}>{formatDuration(row())}</dd>
              </dl>
              <Show when={row().traceUrl}>
                {(traceUrl) => (
                  <a
                    class={css({
                      color: "zodiac.gold",
                      display: "inline-block",
                      fontFamily: "mono",
                      fontSize: "sm",
                      mt: "4",
                    })}
                    href={traceUrl()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open LangSmith Trace ↗
                  </a>
                )}
              </Show>
            </UICard>

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
                  <div class={css({ display: "grid", gap: "4" })}>
                    <div
                      class={css({
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "2",
                      })}
                    >
                      <UIBadge tone="gold">{draftLabel(draft().kind)}</UIBadge>
                      <UIBadge tone={draft().needsReview ? "violet" : "cream"}>
                        {draft().needsReview ? "Needs Review" : "Read Only"}
                      </UIBadge>
                    </div>
                    <h3
                      class={css({
                        color: "zodiac.cream",
                        fontFamily: "display",
                        fontSize: "2xl",
                        lineHeight: "1.2",
                      })}
                    >
                      {draft().title}
                    </h3>
                    <p class={helperClass}>{draft().summary}</p>
                    <div>
                      <div class={fieldLabelClass}>Candidate IDs</div>
                      <div
                        class={css({
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "2",
                          mt: "2",
                        })}
                      >
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
              <Show
                when={
                  !persistedDrafts.isLoading() &&
                  (persistedDrafts.data() ?? []).length > 0
                }
                fallback={
                  <p class={helperClass}>
                    {persistedDrafts.isLoading()
                      ? "Loading persisted drafts..."
                      : persistedDrafts.error()
                        ? `Unable to load persisted drafts: ${persistedDrafts.error()?.message}`
                        : "No persisted human-review draft rows are linked to this run yet."}
                  </p>
                }
              >
                <div class={css({ display: "grid", gap: "4" })}>
                  <For
                    each={
                      (persistedDrafts.data() ?? []) as PersistedReviewDraft[]
                    }
                  >
                    {(draft) => (
                      <article
                        class={css({
                          borderColor: "rgba(245, 240, 232, 0.12)",
                          borderRadius: "l2",
                          borderWidth: "1px",
                          display: "grid",
                          gap: "3",
                          p: "4",
                        })}
                      >
                        <div
                          class={css({
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "2",
                            justifyContent: "space-between",
                          })}
                        >
                          <div
                            class={css({
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "2",
                            })}
                          >
                            <UIBadge tone="gold">
                              {draftLabel(draft.kind)}
                            </UIBadge>
                            <UIBadge
                              tone={
                                draft.status === "pending_review"
                                  ? "violet"
                                  : "cream"
                              }
                            >
                              {draft.status}
                            </UIBadge>
                          </div>
                          <span class={monoClass}>
                            {formatTime(draft.createdAt)}
                          </span>
                        </div>
                        <h3
                          class={css({
                            color: "zodiac.cream",
                            fontFamily: "display",
                            fontSize: "xl",
                            lineHeight: "1.2",
                          })}
                        >
                          {draft.title}
                        </h3>
                        <p class={helperClass}>{draft.summary}</p>
                        <DraftPayloadPreview
                          kind={draft.kind}
                          payload={draft.payload}
                        />
                        <div>
                          <div class={fieldLabelClass}>Draft Row</div>
                          <span class={monoClass}>{String(draft._id)}</span>
                        </div>
                        <div>
                          <div class={fieldLabelClass}>Candidate IDs</div>
                          <div
                            class={css({
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "2",
                              mt: "2",
                            })}
                          >
                            <For each={draft.candidateIds}>
                              {(candidateId) => (
                                <UIBadge tone="cream">{candidateId}</UIBadge>
                              )}
                            </For>
                          </div>
                        </div>
                        <PersistedDraftActions draft={draft} />
                      </article>
                    )}
                  </For>
                </div>
              </Show>
            </UICard>

            <UICard>
              <h2 class={sectionTitleClass}>Event Timeline</h2>
              <Show
                when={!events.isLoading() && (events.data() ?? []).length > 0}
                fallback={
                  <p class={helperClass}>
                    {events.isLoading()
                      ? "Loading events..."
                      : events.error()
                        ? `Unable to load events: ${events.error()?.message}`
                        : "No events recorded for this run."}
                  </p>
                }
              >
                <div class={css({ display: "grid", gap: "4" })}>
                  <For each={events.data() ?? []}>
                    {(event: Doc<"agentRunEvents">) => {
                      const payload = () => formatPayload(event.payload);
                      return (
                        <article class={eventClass}>
                          <div
                            class={css({
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "2",
                              justifyContent: "space-between",
                            })}
                          >
                            <UIBadge tone={eventTone(event.kind)}>
                              {event.kind}
                            </UIBadge>
                            <span class={monoClass}>
                              {formatTime(event.createdAt)}
                            </span>
                          </div>
                          <p
                            class={css({
                              color: "zodiac.cream",
                              lineHeight: "1.55",
                            })}
                          >
                            {event.message}
                          </p>
                          <Show when={payload()}>
                            {(text) => (
                              <pre
                                class={css({
                                  bg: "rgba(0, 0, 0, 0.22)",
                                  borderColor: "rgba(245, 240, 232, 0.12)",
                                  borderRadius: "l2",
                                  borderWidth: "1px",
                                  color: "rgba(245, 240, 232, 0.72)",
                                  fontFamily: "mono",
                                  fontSize: "xs",
                                  maxH: "18rem",
                                  overflow: "auto",
                                  p: "3",
                                  whiteSpace: "pre-wrap",
                                })}
                              >
                                {text()}
                              </pre>
                            )}
                          </Show>
                        </article>
                      );
                    }}
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
