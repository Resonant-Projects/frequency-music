import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PENDING_DRAFT_CAP } from "../../../convex/shared/agentContract";
import { css } from "../../styled-system/css";
import {
  type DraftReviewContext,
  DraftReviewStory,
  type AgentDraftPayload,
  type PersistedReviewDraft,
  PromotedLink,
  draftLabel,
} from "../components/agent-draft";
import {
  fieldLabelClass,
  pageClass,
  pageTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UISelect,
  UITextarea,
} from "../components/ui";
import { createMutation, createQueryWithStatus } from "../integrations/convex";

const helperClass = css({
  color: "rgba(245, 240, 232, 0.66)",
  fontFamily: "display",
  fontSize: "lg",
  lineHeight: "1.6",
});

const eyebrowClass = css({
  color: "rgba(245, 240, 232, 0.58)",
  fontFamily: "mono",
  fontSize: "2xs",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
});

const queueButtonClass = css({
  bg: "rgba(13, 6, 32, 0.48)",
  borderColor: "rgba(245, 240, 232, 0.12)",
  borderRadius: "l2",
  borderWidth: "1px",
  color: "zodiac.cream",
  cursor: "pointer",
  display: "grid",
  gap: "2",
  p: "3",
  textAlign: "left",
  transitionDuration: "normal",
  transitionProperty: "background-color, border-color",
  width: "full",
  _hover: {
    bg: "rgba(139, 92, 246, 0.08)",
    borderColor: "rgba(139, 92, 246, 0.36)",
  },
  _focusVisible: {
    borderColor: "zodiac.violet",
    outline: "none",
  },
});

const activeQueueButtonClass = css({
  bg: "rgba(139, 92, 246, 0.12)",
  borderColor: "rgba(139, 92, 246, 0.52)",
});

const decideBarClass = css({
  backdropFilter: "blur(14px)",
  bg: "rgba(13, 6, 32, 0.94)",
  borderColor: "rgba(200, 168, 75, 0.5)",
  borderRadius: "l3",
  borderWidth: "1px",
  bottom: "4",
  boxShadow: "0 -12px 40px rgba(13, 6, 32, 0.6)",
  display: "grid",
  gap: "3",
  p: { base: "3", md: "4" },
  position: "sticky",
  zIndex: "10",
});

type Promotion = { kind: PersistedReviewDraft["kind"]; promotedId: string };
type Decision = "approve" | "reject" | "supersede";

function formatAge(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function queueStatement(draft: PersistedReviewDraft) {
  if (draft.payload && "statement" in draft.payload) {
    return draft.payload.statement;
  }
  return draft.summary;
}

function queueContextLabel(draft: PersistedReviewDraft) {
  if (draft.reviewPair) {
    return `${draft.reviewPair.conceptA} × ${draft.reviewPair.conceptB}`;
  }
  if (draft.payload && "statement" in draft.payload) {
    const concepts = draft.payload.concepts ?? [];
    if (concepts.length >= 2) return `${concepts[0]} × ${concepts[1]}`;
  }
  if (draft.payload && "parameters" in draft.payload) {
    return draft.title;
  }
  return "No correspondence lineage";
}

function DecideBar(props: {
  context: DraftReviewContext;
  pendingDrafts: PersistedReviewDraft[];
  payload?: AgentDraftPayload;
  editMode: boolean;
  editedFields: string[];
  onEnterEdit: () => void;
  onCancelEdit: () => void;
  onApproved: (promotion: Promotion) => void;
}) {
  const approve = createMutation(api.agentDrafts.approve);
  const reject = createMutation(api.agentDrafts.reject);
  const supersede = createMutation(api.agentDrafts.supersede);
  const [decision, setDecision] = createSignal<Decision | null>(null);
  const [overflowOpen, setOverflowOpen] = createSignal(false);
  const [note, setNote] = createSignal("");
  const [supersedingDraftId, setSupersedingDraftId] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let noteInput: HTMLTextAreaElement | undefined;
  let overflowTrigger: HTMLButtonElement | undefined;

  const draft = () => props.context.draft;

  createEffect(
    on(
      () => props.context.draft._id,
      () => {
        setDecision(null);
        setOverflowOpen(false);
        setNote("");
        setSupersedingDraftId("");
        setBusy(false);
        setError(null);
      },
    ),
  );

  const alternatives = createMemo(() =>
    props.pendingDrafts.filter((row) => row._id !== draft()._id),
  );
  const canConfirm = createMemo(() => {
    if (decision() === "approve") return Boolean(props.payload);
    if (decision() === "reject") return note().trim().length > 0;
    if (decision() === "supersede") return supersedingDraftId().length > 0;
    return false;
  });

  function chooseDecision(next: Decision) {
    setDecision(next);
    setOverflowOpen(false);
    setError(null);
    if (next === "approve" || next === "reject") {
      queueMicrotask(() => noteInput?.focus());
    }
  }

  function cancelDecision() {
    setDecision(null);
    setError(null);
    setSupersedingDraftId("");
  }

  function enterEditMode() {
    setDecision(null);
    setError(null);
    props.onEnterEdit();
  }

  async function confirmDecision() {
    const selected = decision();
    if (!selected || !canConfirm()) return;
    setBusy(true);
    setError(null);
    try {
      if (selected === "approve") {
        const payload = normalizePayloadForApproval(props.payload);
        const result = await approve({
          draftId: draft()._id,
          ...(note().trim() ? { decisionNote: note().trim() } : {}),
          ...(props.editedFields.length > 0 && payload
            ? { amendedPayload: payload }
            : {}),
        });
        props.onApproved({
          kind: draft().kind,
          promotedId: String(result.promotedId),
        });
      } else if (selected === "reject") {
        await reject({
          draftId: draft()._id,
          decisionNote: note().trim(),
        });
      } else {
        const replacement = alternatives().find(
          (row) => row._id === supersedingDraftId(),
        );
        if (!replacement) return;
        await supersede({
          draftId: draft()._id,
          byDraftId: replacement._id,
          ...(note().trim() ? { decisionNote: note().trim() } : {}),
        });
      }
      setDecision(null);
      setNote("");
      setSupersedingDraftId("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Draft decision failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleShortcut(event: KeyboardEvent) {
    if (event.key === "Escape" && overflowOpen()) {
      event.preventDefault();
      setOverflowOpen(false);
      queueMicrotask(() => overflowTrigger?.focus());
      return;
    }
    if (event.key === "Escape" && decision()) {
      event.preventDefault();
      cancelDecision();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement
    ) {
      return;
    }
    if (event.key.toLowerCase() === "a" && draft().payload) {
      event.preventDefault();
      chooseDecision("approve");
    }
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      chooseDecision("reject");
    }
    if (event.key.toLowerCase() === "e" && draft().payload) {
      event.preventDefault();
      enterEditMode();
    }
  }

  onMount(() => window.addEventListener("keydown", handleShortcut));
  onCleanup(() => window.removeEventListener("keydown", handleShortcut));

  return (
    <div class={decideBarClass}>
      <div
        class={css({
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: "2",
          justifyContent: "space-between",
        })}
      >
        <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
          <UIButton
            variant="solid"
            disabled={busy() || !props.payload}
            aria-keyshortcuts="A"
            onClick={() => chooseDecision("approve")}
          >
            {props.editedFields.length > 0 ? "Approve with edits" : "Approve"}
            {" · A"}
          </UIButton>
          <UIButton
            variant="solid"
            disabled={busy()}
            aria-keyshortcuts="R"
            onClick={() => chooseDecision("reject")}
          >
            Reject · R
          </UIButton>
          <div class={css({ position: "relative" })}>
            <UIButton
              ref={(element) => {
                overflowTrigger = element;
              }}
              variant="outline"
              disabled={busy() || alternatives().length === 0}
              aria-expanded={overflowOpen()}
              aria-haspopup="menu"
              onClick={() => setOverflowOpen((open) => !open)}
            >
              More decisions ···
            </UIButton>
            <Show when={overflowOpen()}>
              <div
                role="menu"
                aria-label="Additional draft decisions"
                class={css({
                  bg: "rgba(13, 6, 32, 0.98)",
                  borderColor: "rgba(139, 92, 246, 0.42)",
                  borderRadius: "l2",
                  borderWidth: "1px",
                  display: "grid",
                  left: "0",
                  minW: "48",
                  mt: "1",
                  p: "1",
                  position: "absolute",
                  top: "full",
                  zIndex: "20",
                })}
              >
                <UIButton
                  variant="ghost"
                  role="menuitem"
                  onClick={() => chooseDecision("supersede")}
                >
                  Supersede with draft…
                </UIButton>
              </div>
            </Show>
          </div>
          <Show
            when={props.editMode}
            fallback={
              <UIButton
                variant="outline"
                disabled={busy() || !draft().payload}
                aria-keyshortcuts="E"
                onClick={enterEditMode}
              >
                Edit · E
              </UIButton>
            }
          >
            <UIButton
              variant="ghost"
              disabled={busy()}
              onClick={props.onCancelEdit}
            >
              Cancel edits
            </UIButton>
          </Show>
        </div>
        <span class={eyebrowClass}>Shortcuts select, then focus the note</span>
      </div>

      <div class={css({ display: "grid", gap: "2" })}>
        <label class={fieldLabelClass} for={`decision-note-${draft()._id}`}>
          Decision note {decision() === "reject" ? "(required)" : "(optional)"}
        </label>
        <UITextarea
          ref={(element) => {
            noteInput = element;
          }}
          id={`decision-note-${draft()._id}`}
          value={note()}
          onInput={(event) => setNote(event.currentTarget.value)}
          placeholder="Record the reasoning that should feed the learning loop."
        />
      </div>

      <Show when={decision() === "supersede"}>
        <div class={css({ display: "grid", gap: "2" })}>
          <label class={fieldLabelClass} for={`supersede-${draft()._id}`}>
            Replacement draft
          </label>
          <UISelect
            id={`supersede-${draft()._id}`}
            value={supersedingDraftId()}
            onChange={(event) =>
              setSupersedingDraftId(event.currentTarget.value)
            }
          >
            <option value="">Choose a pending draft…</option>
            <For each={alternatives()}>
              {(row) => <option value={row._id}>{row.title}</option>}
            </For>
          </UISelect>
        </div>
      </Show>

      <Show when={decision()}>
        {(selected) => (
          <div
            role="dialog"
            aria-modal="false"
            aria-label={`Confirm ${selected()}`}
            class={css({
              bg: "rgba(200, 168, 75, 0.08)",
              borderColor: "rgba(200, 168, 75, 0.28)",
              borderRadius: "l2",
              borderWidth: "1px",
              display: "grid",
              gap: "3",
              p: "3",
            })}
          >
            <p class={helperClass}>
              {selected() === "approve"
                ? `${props.editedFields.length > 0 ? "Approval with edits" : "Approval"} will create a ${draft().kind === "hypothesis_draft" ? "hypothesis" : "recipe"} titled “${props.payload?.title ?? draft().title}”.`
                : selected() === "reject"
                  ? "Rejection closes this draft and preserves the note as learning signal."
                  : "Superseding closes this draft in favor of the selected pending draft."}
            </p>
            <Show
              when={selected() === "approve" && props.editedFields.length > 0}
            >
              <div class={css({ display: "grid", gap: "2" })}>
                <p class={eyebrowClass}>Changed fields</p>
                <div
                  class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}
                >
                  <For each={props.editedFields}>
                    {(field) => <UIBadge tone="violet">{field}</UIBadge>}
                  </For>
                </div>
              </div>
            </Show>
            <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
              <UIButton
                variant="solid"
                disabled={busy() || !canConfirm()}
                onClick={confirmDecision}
              >
                {busy()
                  ? "Deciding…"
                  : selected() === "approve" && props.editedFields.length > 0
                    ? "Approve with edits"
                    : `Confirm ${selected() === "approve" ? "approval" : selected()}`}
              </UIButton>
              <UIButton
                variant="ghost"
                disabled={busy()}
                onClick={cancelDecision}
              >
                Cancel
              </UIButton>
            </div>
          </div>
        )}
      </Show>

      <Show when={!draft().payload}>
        <p class={helperClass}>
          This legacy draft has no structured payload. Reject it with a note or
          supersede it; approval is unavailable.
        </p>
      </Show>
      <Show when={error()}>
        {(message) => (
          <p aria-live="polite" class={css({ color: "zodiac.error" })}>
            {message()}
          </p>
        )}
      </Show>
    </div>
  );
}

function normalizePayloadForApproval(
  payload: AgentDraftPayload | undefined,
): AgentDraftPayload | undefined {
  if (!payload || !("parameters" in payload) || !payload.dawChecklist) {
    return payload;
  }
  return {
    ...payload,
    dawChecklist: payload.dawChecklist
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function editablePayloadProjection(
  kind: PersistedReviewDraft["kind"],
  payload: AgentDraftPayload,
): Record<string, unknown> {
  if (kind === "hypothesis_draft" && "statement" in payload) {
    return {
      title: payload.title,
      question: payload.question,
      statement: payload.statement,
      whyThisMatters: payload.whyThisMatters,
    };
  }
  if (kind === "recipe_draft" && "parameters" in payload) {
    return {
      title: payload.title,
      whyThisMatters: payload.whyThisMatters,
      bodyMd: payload.bodyMd,
      instrumentationNotes: payload.instrumentationNotes,
      dawChecklist: payload.dawChecklist,
    };
  }
  return {};
}

function editableFieldDiff(
  kind: PersistedReviewDraft["kind"],
  original: AgentDraftPayload | undefined,
  working: AgentDraftPayload | undefined,
) {
  if (!original || !working) return [];
  const originalFields = editablePayloadProjection(kind, original);
  const workingFields = editablePayloadProjection(kind, working);
  return Object.keys(originalFields).filter(
    (field) =>
      JSON.stringify(originalFields[field]) !==
      JSON.stringify(workingFields[field]),
  );
}

function ReviewWorkspace(props: {
  context: DraftReviewContext;
  pendingDrafts: PersistedReviewDraft[];
  onApproved: (promotion: Promotion) => void;
}) {
  const [editMode, setEditMode] = createSignal(false);
  const [workingPayload, setWorkingPayload] = createSignal<
    AgentDraftPayload | undefined
  >(props.context.draft.payload);

  createEffect(
    on(
      () => props.context.draft._id,
      () => {
        setEditMode(false);
        setWorkingPayload(props.context.draft.payload);
      },
    ),
  );

  const editedFields = createMemo(() =>
    editableFieldDiff(
      props.context.draft.kind,
      props.context.draft.payload,
      workingPayload(),
    ),
  );

  function cancelEdits() {
    setWorkingPayload(props.context.draft.payload);
    setEditMode(false);
  }

  return (
    <DraftReviewStory
      context={props.context}
      payload={workingPayload()}
      editMode={editMode()}
      onPayloadChange={setWorkingPayload}
      decide={
        <DecideBar
          context={props.context}
          pendingDrafts={props.pendingDrafts}
          payload={workingPayload()}
          editMode={editMode()}
          editedFields={editedFields()}
          onEnterEdit={() => setEditMode(true)}
          onCancelEdit={cancelEdits}
          onApproved={props.onApproved}
        />
      }
    />
  );
}

export function AgentDraftsPage() {
  onMount(() => {
    document.title = "Review Queue — Frequency Music";
  });

  const pending = createQueryWithStatus(api.agentDrafts.listPending, () => ({
    limit: 50,
  }));
  const pendingCount = createQueryWithStatus(
    api.agentDrafts.countPendingPublic,
  );
  const pendingHypothesisCount = createQueryWithStatus(
    api.agentDrafts.countPendingHypothesesPublic,
  );
  const [activeDraftId, setActiveDraftId] =
    createSignal<Id<"agentReviewDrafts"> | null>(null);
  const [lastPromotion, setLastPromotion] = createSignal<Promotion | null>(
    null,
  );
  const rows = createMemo(
    () => (pending.data() ?? []) as PersistedReviewDraft[],
  );
  const hypothesisPendingCount = createMemo(
    () =>
      pendingHypothesisCount.data() ??
      rows().filter((draft) => draft.kind === "hypothesis_draft").length,
  );
  const context = createQueryWithStatus(
    api.agentDrafts.getReviewContext,
    () => {
      const draftId = activeDraftId();
      return draftId ? { draftId } : "skip";
    },
  );

  createEffect(() => {
    const pendingRows = rows();
    const selected = activeDraftId();
    if (!selected || !pendingRows.some((row) => row._id === selected)) {
      setActiveDraftId(pendingRows[0]?._id ?? null);
    }
  });

  return (
    <section class={pageClass}>
      <UICard style={{ "border-color": "rgba(139, 92, 246, 0.24)" }}>
        <p class={eyebrowClass}>Human review gate</p>
        <h1 class={pageTitleClass}>Draft Review Queue</h1>
        <p class={helperClass}>
          Read the complete correspondence story, then make the decision while
          the evidence is still in view.
        </p>
        <div
          class={css({
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "2",
            mt: "4",
          })}
        >
          <UIBadge
            tone={
              hypothesisPendingCount() >= PENDING_DRAFT_CAP ? "violet" : "cream"
            }
          >
            {pendingCount.data() ?? rows().length} draft
            {(pendingCount.data() ?? rows().length) === 1 ? "" : "s"} awaiting
            review
          </UIBadge>
          <span class={eyebrowClass}>
            {hypothesisPendingCount() >= PENDING_DRAFT_CAP
              ? `agent blocked at ${PENDING_DRAFT_CAP}`
              : `${hypothesisPendingCount()} of ${PENDING_DRAFT_CAP} hypothesis slots filled`}
          </span>
        </div>
      </UICard>

      <Show when={lastPromotion()}>
        {(promotion) => (
          <UICard style={{ "border-color": "rgba(139, 92, 246, 0.24)" }}>
            <UIBadge tone="violet">Promoted</UIBadge>
            <h2 class={pageTitleClass}>Draft approved</h2>
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
          <UICard style={{ "border-color": "rgba(245, 240, 232, 0.12)" }}>
            <p class={helperClass}>
              {pending.isLoading()
                ? "Loading pending drafts…"
                : pending.error()
                  ? `Unable to load pending drafts: ${pending.error()?.message}`
                  : "No drafts are awaiting review. The queue is clear."}
            </p>
          </UICard>
        }
      >
        <div
          class={css({
            alignItems: "start",
            display: "grid",
            gap: "5",
            gridTemplateColumns: {
              base: "1fr",
              lg: "minmax(250px, 0.34fr) minmax(0, 1fr)",
            },
          })}
        >
          <aside
            aria-label="Pending drafts, oldest first"
            class={css({
              display: "grid",
              gap: "3",
              position: { lg: "sticky" },
              top: { lg: "4" },
            })}
          >
            <p class={eyebrowClass}>Oldest first</p>
            <For each={rows()}>
              {(draft) => (
                <button
                  type="button"
                  class={`${queueButtonClass} ${activeDraftId() === draft._id ? activeQueueButtonClass : ""}`}
                  aria-pressed={activeDraftId() === draft._id}
                  onClick={() => setActiveDraftId(draft._id)}
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
                    <UIBadge tone="violet">{draftLabel(draft.kind)}</UIBadge>
                    <span class={eyebrowClass}>
                      {formatAge(draft.createdAt)}
                    </span>
                  </div>
                  <p
                    class={css({
                      fontFamily: "display",
                      fontSize: "lg",
                      lineHeight: "1.35",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    })}
                  >
                    {queueStatement(draft)}
                  </p>
                  <span class={eyebrowClass}>{queueContextLabel(draft)}</span>
                </button>
              )}
            </For>
          </aside>

          <UICard glass style={{ "border-color": "rgba(245, 240, 232, 0.12)" }}>
            <Show
              when={!context.isLoading() && context.data()}
              fallback={
                <p class={helperClass}>
                  {context.error()
                    ? `Unable to load review context: ${context.error()?.message}`
                    : "Loading the correspondence story…"}
                </p>
              }
            >
              {(reviewContext) => (
                <ReviewWorkspace
                  context={reviewContext()}
                  pendingDrafts={rows()}
                  onApproved={setLastPromotion}
                />
              )}
            </Show>
          </UICard>
        </div>
      </Show>
    </section>
  );
}
