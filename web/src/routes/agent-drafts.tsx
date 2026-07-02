import { Link } from "@tanstack/solid-router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  DraftPayloadPreview,
  type PersistedReviewDraft,
  PromotedLink,
  draftLabel,
} from "../components/agent-draft";
import {
  fieldLabelClass,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UITextarea,
} from "../components/ui";
import { createMutation, createQueryWithStatus } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

const helperClass = css({
  color: "rgba(245, 240, 232, 0.62)",
  lineHeight: "1.6",
});

const metaClass = css({
  color: "rgba(245, 240, 232, 0.6)",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

const draftCardClass = css({
  borderColor: "rgba(245, 240, 232, 0.12)",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "grid",
  gap: "3",
  p: "4",
});

function formatTime(value?: number) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

type Promotion = { kind: PersistedReviewDraft["kind"]; promotedId: string };

/** Loads the parent run so the queue can surface the LangSmith trace URL. */
function RunTraceLink(props: { agentRunId: Id<"agentRuns"> }) {
  const run = createQueryWithStatus(convexApi.agentRuns.getPublic, () => ({
    runId: props.agentRunId,
  }));
  const traceUrl = createMemo(
    () => (run.data() as Doc<"agentRuns"> | null | undefined)?.traceUrl,
  );
  return (
    <div class={css({ display: "flex", flexWrap: "wrap", gap: "3" })}>
      <Link
        to="/agent-runs/$runId"
        params={{ runId: String(props.agentRunId) }}
        class={css({
          color: "zodiac.gold",
          fontFamily: "mono",
          fontSize: "xs",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        })}
      >
        Open Run ↗
      </Link>
      <Show when={traceUrl()}>
        {(url) => (
          <a
            class={css({
              color: "zodiac.gold",
              fontFamily: "mono",
              fontSize: "xs",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            })}
            href={url()}
            target="_blank"
            rel="noreferrer"
          >
            Trace ↗
          </a>
        )}
      </Show>
    </div>
  );
}

function DraftReviewCard(props: {
  draft: PersistedReviewDraft;
  onApproved: (promotion: Promotion) => void;
}) {
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
      const result = await approve({
        draftId: props.draft._id,
        ...(note().trim() ? { decisionNote: note().trim() } : {}),
      });
      if (result?.promotedId) {
        props.onApproved({
          kind: props.draft.kind,
          promotedId: String(result.promotedId),
        });
      }
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
    <article class={draftCardClass}>
      <div
        class={css({
          display: "flex",
          flexWrap: "wrap",
          gap: "2",
          justifyContent: "space-between",
        })}
      >
        <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
          <UIBadge tone="gold">{draftLabel(props.draft.kind)}</UIBadge>
          <UIBadge tone="violet">{props.draft.status}</UIBadge>
        </div>
        <span class={metaClass}>{formatTime(props.draft.createdAt)}</span>
      </div>

      <h3
        class={css({
          color: "zodiac.cream",
          fontFamily: "display",
          fontSize: "xl",
          lineHeight: "1.2",
        })}
      >
        {props.draft.title}
      </h3>
      <p class={helperClass}>{props.draft.summary}</p>

      <DraftPayloadPreview
        kind={props.draft.kind}
        payload={props.draft.payload}
      />

      <Show when={props.draft.candidateIds.length > 0}>
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
            <For each={props.draft.candidateIds}>
              {(candidateId) => <UIBadge tone="cream">{candidateId}</UIBadge>}
            </For>
          </div>
        </div>
      </Show>

      <RunTraceLink agentRunId={props.draft.agentRunId} />

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
      </div>

      <Show when={!canPromote()}>
        <p class={helperClass}>
          This draft has no structured payload, so it cannot be promoted. It can
          only be rejected with a note.
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
    </article>
  );
}

export function AgentDraftsPage() {
  onMount(() => {
    document.title = "Review Queue — Frequency Music";
  });

  const pending = createQueryWithStatus(
    convexApi.agentDrafts.listPending,
    () => ({
      limit: 50,
    }),
  );

  const [lastPromotion, setLastPromotion] = createSignal<Promotion | null>(
    null,
  );

  const rows = createMemo(
    () => (pending.data() ?? []) as PersistedReviewDraft[],
  );

  const groups = createMemo(() => {
    const byGraph = new Map<string, PersistedReviewDraft[]>();
    for (const draft of rows()) {
      const list = byGraph.get(draft.graphName) ?? [];
      list.push(draft);
      byGraph.set(draft.graphName, list);
    }
    return Array.from(byGraph.entries()).map(([graphName, drafts]) => ({
      graphName,
      drafts,
    }));
  });

  return (
    <section class={pageClass}>
      <UICard>
        <UIBadge tone="gold">Human Review Gate</UIBadge>
        <h1 class={pageTitleClass}>Draft Review Queue</h1>
        <p class={helperClass}>
          Agent-produced hypothesis and recipe drafts awaiting human approval.
          Approving a draft promotes its structured payload into a real
          hypothesis or recipe with full provenance; rejecting requires a note
          so the learning loop has signal.
        </p>
        <div class={css({ mt: "3" })}>
          <UIBadge tone="violet">{rows().length} Pending</UIBadge>
        </div>
      </UICard>

      <Show when={lastPromotion()}>
        {(promotion) => (
          <UICard>
            <UIBadge tone="gold">Promoted</UIBadge>
            <h2 class={sectionTitleClass}>Draft approved</h2>
            <p class={helperClass}>
              The draft was promoted into a new{" "}
              {promotion().kind === "hypothesis_draft"
                ? "hypothesis"
                : "recipe"}
              .
            </p>
            <PromotedLink
              kind={promotion().kind}
              promotedId={promotion().promotedId}
            />
          </UICard>
        )}
      </Show>

      <Show
        when={!pending.isLoading() && rows().length > 0}
        fallback={
          <UICard>
            <p class={helperClass}>
              {pending.isLoading()
                ? "Loading pending drafts..."
                : pending.error()
                  ? `Unable to load pending drafts: ${pending.error()?.message}`
                  : "No drafts are awaiting review. The queue is clear."}
            </p>
          </UICard>
        }
      >
        <For each={groups()}>
          {(group) => (
            <UICard>
              <div
                class={css({
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "2",
                  justifyContent: "space-between",
                  mb: "3",
                })}
              >
                <h2 class={sectionTitleClass}>{group.graphName}</h2>
                <UIBadge tone="cream">{group.drafts.length}</UIBadge>
              </div>
              <div class={css({ display: "grid", gap: "4" })}>
                <For each={group.drafts}>
                  {(draft) => (
                    <DraftReviewCard
                      draft={draft}
                      onApproved={setLastPromotion}
                    />
                  )}
                </For>
              </div>
            </UICard>
          )}
        </For>
      </Show>
    </section>
  );
}
