import { useNavigate, useSearch } from "@tanstack/solid-router";
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PENDING_DRAFT_CAP } from "../../../convex/shared/agentContract";
import { css, cx } from "../../styled-system/css";
import { IntentReviewBinding } from "../components/intent-review-binding";
import { sameIds } from "../lib/keyed-rows";
import {
  type DraftReviewContext,
  DraftReviewStory,
  DecisionState,
  type AgentDraftPayload,
  type PersistedReviewDraft,
  PromotedLink,
  draftLabel,
} from "../components/agent-draft";
import {
  badgeRowClass,
  collapsedNoticeClass,
  createAnnouncer,
  DateTime,
  eyebrowClass,
  fieldLabelClass,
  metaLabelClass,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIList,
  UINotice,
  UISelect,
  UITextarea,
} from "../components/ui";
import {
  createMutation,
  createQueryWithStatus,
  describeError,
} from "../integrations/convex";

/** Lead copy on this page: the 0.66 cream floor at the prose measure. */
const leadClass = css({
  color: "zodiac.cream/66",
  fontFamily: "display",
  fontSize: "lg",
  lineHeight: "prose",
  maxW: "measure",
});

/**
 * UICard already sets a gold hairline; the doubled selector outranks it so the
 * override does not depend on atomic stylesheet order.
 */
const violetCardClass = css({ "&&": { borderColor: "zodiac.violet/24" } });
const neutralCardClass = css({ "&&": { borderColor: "zodiac.cream/12" } });

const queueButtonClass = css({
  bg: "zodiac.void/48",
  borderColor: "zodiac.cream/12",
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
    bg: "zodiac.violet/8",
    borderColor: "zodiac.violet/36",
  },
  // The gold ring itself is the global focus-visible default.
  _focusVisible: { borderColor: "zodiac.violet" },
});

/** The queue row whose draft is open in the review panel. */
const activeQueueButtonClass = css({
  bg: "zodiac.violet/12",
  borderColor: "zodiac.violet/52",
});

const queueRowHeaderClass = css({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "2",
  justifyContent: "space-between",
});

const queueStatementClass = css({
  fontFamily: "display",
  fontSize: "lg",
  lineClamp: "2",
  lineHeight: "display",
});

const queueListClass = css({ display: "grid", gap: "3" });

const decideBarClass = css({
  bg: "zodiac.void/94",
  borderColor: "zodiac.gold/50",
  borderRadius: "l3",
  borderWidth: "1px",
  bottom: "4",
  // Sticky only where there is room for it: on a phone a pinned bar holding
  // four buttons, a note and a confirm block would cover most of the draft.
  boxShadow: { md: "detachedBar" },
  display: "grid",
  gap: "3",
  p: { base: "3", md: "4" },
  position: { base: "static", md: "sticky" },
  zIndex: "docked",
});

type DraftId = Id<"agentReviewDrafts">;

/** What the decide bar reports once a decision is recorded. */
type DecidedDraft = { draftId: DraftId; message: string };

const queueButtonDomId = (draftId: string) => `draft-queue-${draftId}`;
const PAGE_TITLE_ID = "draft-review-title";

/**
 * The row that should take over when `removedId` leaves the queue: the next
 * surviving row in the previous order, else the nearest one before it.
 */
function successorDraftId<T extends string>(
  currentIds: readonly T[],
  previousIds: readonly T[],
  removedId: T,
): T | null {
  const index = previousIds.indexOf(removedId);
  if (index !== -1) {
    const after = previousIds
      .slice(index + 1)
      .find((id) => currentIds.includes(id));
    if (after) return after;
    const before = previousIds
      .slice(0, index)
      .reverse()
      .find((id) => currentIds.includes(id));
    if (before) return before;
  }
  return currentIds.find((id) => id !== removedId) ?? null;
}

const decisionOutcome: Record<Decision, string> = {
  approve: "approved",
  reject: "rejected",
  supersede: "superseded",
};

type Promotion = { kind: PersistedReviewDraft["kind"]; promotedId: string };
type Decision = "approve" | "reject" | "supersede";

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
  /**
   * The review panel root. Single-key shortcuts are bound here rather than on
   * `window` so they only fire while focus is inside the draft (WCAG 2.1.4).
   */
  shortcutScope: () => HTMLElement | undefined;
  onEnterEdit: () => void;
  onCancelEdit: () => void;
  onApproved: (promotion: Promotion) => void;
  /**
   * Called once a decision is recorded, while this bar may still hold focus.
   * The page moves focus to a surviving control and announces the outcome.
   */
  onDecided: (decided: DecidedDraft) => void;
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
  let decisionTrigger: HTMLButtonElement | undefined;
  let supersedeSelect: HTMLSelectElement | undefined;
  const overflowId = createUniqueId();

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

  function chooseDecision(next: Decision, trigger?: HTMLButtonElement) {
    decisionTrigger = trigger;
    setDecision(next);
    setOverflowOpen(false);
    setError(null);
    // Approve/reject land in the note, which the on-screen hint promises.
    // Supersede lands on its select: the confirm button stays disabled until a
    // replacement is chosen, and a disabled control cannot take focus at all.
    queueMicrotask(() => {
      if (next === "approve" || next === "reject") noteInput?.focus();
      else supersedeSelect?.focus();
    });
  }

  function cancelDecision() {
    setDecision(null);
    setError(null);
    setSupersedingDraftId("");
    const trigger = decisionTrigger;
    decisionTrigger = undefined;
    queueMicrotask(() => trigger?.focus());
  }

  function enterEditMode() {
    setDecision(null);
    setError(null);
    props.onEnterEdit();
  }

  async function confirmDecision() {
    const selected = decision();
    // In-flight guard instead of `disabled`: disabling the focused Confirm
    // button would blur it before focus can be handed off.
    if (busy() || !selected || !canConfirm()) return;
    // Capture before awaiting: the queue subscription can retire this draft
    // (and unmount this bar) before the mutation promise resolves.
    const decidedId = draft()._id;
    const decidedTitle = draft().title;
    const onDecided = props.onDecided;
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
      // Hand focus off before the confirm group unmounts.
      onDecided({
        draftId: decidedId,
        message: `Decision recorded: ${decidedTitle} ${decisionOutcome[selected]}.`,
      });
      setDecision(null);
      setNote("");
      setSupersedingDraftId("");
    } catch (caught) {
      setError(describeError(caught));
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
    if (event.repeat || event.isComposing) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement
    ) {
      return;
    }
    // Links, disclosures, editable regions and the scrollable protocol block
    // own their own keys.
    if (
      target instanceof Element &&
      target.closest(
        'a, summary, [contenteditable]:not([contenteditable="false"]), pre[tabindex]',
      )
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

  createEffect(() => {
    const scope = props.shortcutScope();
    if (!scope) return;
    scope.addEventListener("keydown", handleShortcut);
    onCleanup(() => scope.removeEventListener("keydown", handleShortcut));
  });

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
            variant="outline"
            disabled={busy() || !props.payload}
            aria-pressed={decision() === "approve"}
            aria-keyshortcuts="A"
            onClick={(event) =>
              chooseDecision(
                "approve",
                event.currentTarget as HTMLButtonElement,
              )
            }
          >
            {props.editedFields.length > 0 ? "Approve with edits" : "Approve"}
            <span aria-hidden="true"> · A</span>
          </UIButton>
          <UIButton
            // Ghost at rest; pressed takes the outline face, which is the one
            // UIButton styles for `aria-pressed`.
            variant={decision() === "reject" ? "outline" : "ghost"}
            disabled={busy()}
            aria-pressed={decision() === "reject"}
            aria-keyshortcuts="R"
            onClick={(event) =>
              chooseDecision("reject", event.currentTarget as HTMLButtonElement)
            }
          >
            Reject<span aria-hidden="true"> · R</span>
          </UIButton>
          <div class={css({ position: "relative" })}>
            <UIButton
              ref={(element) => {
                overflowTrigger = element;
              }}
              variant="outline"
              disabled={busy() || alternatives().length === 0}
              aria-expanded={overflowOpen()}
              aria-controls={overflowOpen() ? overflowId : undefined}
              onClick={() => setOverflowOpen((open) => !open)}
            >
              More decisions ···
            </UIButton>
            <Show when={overflowOpen()}>
              <div
                id={overflowId}
                role="group"
                aria-label="Additional draft decisions"
                class={css({
                  bg: "zodiac.void/98",
                  borderColor: "zodiac.violet/42",
                  borderRadius: "l2",
                  borderWidth: "1px",
                  display: "grid",
                  left: "0",
                  minW: "48",
                  mt: "1",
                  p: "1",
                  position: "absolute",
                  top: "[100%]",
                  zIndex: "[20]",
                })}
              >
                <UIButton
                  variant="outline"
                  aria-pressed={decision() === "supersede"}
                  onClick={() => chooseDecision("supersede", overflowTrigger)}
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
                Edit<span aria-hidden="true"> · E</span>
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
        <span class={metaLabelClass}>
          A, R or E picks a decision and moves you to the note
        </span>
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
            ref={(element: HTMLSelectElement) => {
              supersedeSelect = element;
            }}
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
            role="group"
            aria-label={`Confirm ${selected()}`}
            class={css({
              bg: "zodiac.gold/8",
              borderColor: "zodiac.gold/28",
              borderRadius: "l2",
              borderWidth: "1px",
              display: "grid",
              gap: "3",
              p: "3",
            })}
          >
            <p class={leadClass}>
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
                <div class={badgeRowClass}>
                  <For each={props.editedFields}>
                    {(field) => <UIBadge tone="violet">{field}</UIBadge>}
                  </For>
                </div>
              </div>
            </Show>
            <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
              <UIButton
                variant="solid"
                disabled={!canConfirm()}
                aria-busy={busy()}
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
        <p class={leadClass}>
          This legacy draft has no structured payload. Reject it with a note or
          supersede it; approval is unavailable.
        </p>
      </Show>
      <UINotice
        class={error() ? undefined : collapsedNoticeClass}
        error={error()}
      />
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
  onDecided: (decided: DecidedDraft) => void;
  /** Focus is inside this panel as it unmounts: move it somewhere stable. */
  onFocusOrphaned: () => void;
}) {
  const [editMode, setEditMode] = createSignal(false);
  const [shortcutScope, setShortcutScope] = createSignal<HTMLElement>();

  // Owner cleanup runs before the DOM is removed, so focus can still be read
  // here and moved before it would fall to <body>.
  onCleanup(() => {
    if (shortcutScope()?.contains(document.activeElement)) {
      props.onFocusOrphaned();
    }
  });
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
    // Shortcut scope: the single-key a/r/e bindings live on this container, so
    // they only fire while focus is inside the draft under review.
    <div ref={setShortcutScope} tabIndex={-1}>
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
            shortcutScope={shortcutScope}
            onEnterEdit={() => setEditMode(true)}
            onCancelEdit={cancelEdits}
            onApproved={props.onApproved}
            onDecided={props.onDecided}
          />
        }
      />
    </div>
  );
}

export function AgentDraftsPage() {
  onMount(() => {
    document.title = "Review Queue — Frequency Music";
  });

  const search = useSearch({ from: "/agent-drafts" });
  const navigate = useNavigate({ from: "/agent-drafts" });
  const linkedDraftId = () => search().draft as DraftId | undefined;
  const linkBlocksQueue = () =>
    Boolean(search().intent || search().invalidReviewLink);

  const pending = createQueryWithStatus(api.agentDrafts.listPending, () => ({
    limit: 50,
  }));
  const pendingCount = createQueryWithStatus(
    api.agentDrafts.countPendingPublic,
  );
  const pendingHypothesisCount = createQueryWithStatus(
    api.agentDrafts.countPendingHypothesesPublic,
  );
  const [queueDraftId, setQueueDraftId] = createSignal<DraftId | null>(null);
  const activeDraftId = () =>
    linkBlocksQueue() ? null : (linkedDraftId() ?? queueDraftId());
  const [navigationError, setNavigationError] = createSignal<string | null>(
    null,
  );
  async function selectDraft(draftId?: DraftId) {
    setNavigationError(null);
    try {
      await navigate({ search: draftId ? { draft: draftId } : {} });
      if (!draftId && !linkedDraftId() && !linkBlocksQueue()) focusActiveRow();
    } catch (error) {
      setNavigationError(describeError(error));
    }
  }
  const [lastPromotion, setLastPromotion] = createSignal<Promotion | null>(
    null,
  );
  const rows = createMemo(
    () => (pending.data() ?? []) as PersistedReviewDraft[],
  );
  // The queue renders from ids, not row objects: every subscription update
  // delivers fresh objects, and keying on them would remount every button
  // (dropping focus) whenever any draft changed.
  const rowIds = createMemo(() => rows().map((row) => row._id), [], {
    equals: sameIds,
  });
  const rowsById = createMemo(
    () => new Map(rows().map((row) => [row._id, row] as const)),
  );
  const [announcement, announce] = createAnnouncer();
  let reviewPanel: HTMLElement | undefined;
  /**
   * A decided draft the queue has not dropped yet: when it leaves, focus
   * follows the active row (its successor, unless the reviewer moved on).
   */
  let focusAfterRemovalOf: DraftId | null = null;

  /**
   * Focus the active queue row's button, or the page title once the row has
   * left the queue. Checks `rowIds()` rather than the DOM: owner cleanup runs
   * before a retired row's button is detached.
   */
  function focusActiveRow() {
    const draftId = activeDraftId();
    const target =
      draftId && rowIds().includes(draftId)
        ? queueButtonDomId(draftId)
        : PAGE_TITLE_ID;
    document.getElementById(target)?.focus();
  }

  function handleDecided(decided: DecidedDraft) {
    announce(decided.message);
    // If the queue update already retired the draft, the panel has unmounted
    // and its cleanup moved focus; only hand off while focus is still here,
    // before the confirm group unmounts.
    if (!reviewPanel?.contains(document.activeElement)) return;
    focusActiveRow();
    focusAfterRemovalOf = rowIds().includes(decided.draftId)
      ? decided.draftId
      : null;
  }

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

  // The one place a successor is picked: a decided or removed draft hands
  // over to the next row in the previous order, not back to the top.
  createEffect<readonly DraftId[]>((previousIds = []) => {
    const ids = rowIds();
    // Explicit links survive queue removal, terminal status, and an empty queue.
    if (linkedDraftId() || linkBlocksQueue()) return ids;
    const selected = queueDraftId();
    const handOff =
      focusAfterRemovalOf !== null && !ids.includes(focusAfterRemovalOf);
    if (handOff) focusAfterRemovalOf = null;
    if (!selected || !ids.includes(selected)) {
      setQueueDraftId(
        selected
          ? successorDraftId(ids, previousIds, selected)
          : (ids[0] ?? null),
      );
      if (handOff) focusActiveRow();
    }
    return ids;
  });

  const queueError = () =>
    pending.error()
      ? `Unable to load pending drafts: ${pending.error()?.message}`
      : null;
  const queueStatus = () => {
    if (pending.isLoading()) return "Loading pending drafts…";
    if (pending.error() || rows().length > 0) return null;
    return "No drafts are awaiting review. The queue is clear.";
  };
  const contextError = () =>
    context.error()
      ? `Unable to load review context: ${context.error()?.message}`
      : null;
  const contextStatus = () => {
    if (context.error()) return null;
    if (context.isLoading()) return "Loading the correspondence story…";
    // A finished query with nothing in it is a removed or missing draft, not a
    // load still in progress.
    if (!context.data()) return "No review context for this draft.";
    return null;
  };

  return (
    <section class={pageClass}>
      <UICard class={violetCardClass}>
        <p class={eyebrowClass}>Human review gate</p>
        <h1 id={PAGE_TITLE_ID} tabIndex={-1} class={pageTitleClass}>
          Draft Review Queue
        </h1>
        <p class={leadClass}>
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
          <span class={metaLabelClass}>
            {hypothesisPendingCount() >= PENDING_DRAFT_CAP
              ? `agent blocked at ${PENDING_DRAFT_CAP}`
              : `${hypothesisPendingCount()} of ${PENDING_DRAFT_CAP} hypothesis slots filled`}
          </span>
        </div>
        <UINotice class={css({ mt: "4" })} status={announcement()} />
      </UICard>

      <UINotice
        error={
          navigationError() ??
          (search().invalidReviewLink
            ? "This review link is invalid. Open the pending queue to continue."
            : null)
        }
      />
      <Show when={linkedDraftId() || linkBlocksQueue()}>
        <div>
          <UIButton variant="outline" onClick={() => void selectDraft()}>
            Back to pending queue
          </UIButton>
        </div>
      </Show>

      <Show when={!search().invalidReviewLink && search().intent} keyed>
        {(intentId) => (
          <IntentReviewBinding intentId={intentId as Id<"decisionIntents">} />
        )}
      </Show>

      <Show when={!linkBlocksQueue() && lastPromotion()}>
        {(promotion) => (
          <UICard class={violetCardClass}>
            <UIBadge tone="violet">Promoted</UIBadge>
            <h2 class={cx(sectionTitleClass, css({ mt: "3" }))}>
              Draft approved
            </h2>
            <PromotedLink
              kind={promotion().kind}
              promotedId={promotion().promotedId}
            />
          </UICard>
        )}
      </Show>

      <UICard
        class={cx(
          neutralCardClass,
          queueStatus() || queueError() ? undefined : collapsedNoticeClass,
        )}
      >
        <UINotice
          class={leadClass}
          status={queueStatus()}
          error={queueError()}
        />
      </UICard>

      <Show when={!linkBlocksQueue() && (activeDraftId() || rows().length > 0)}>
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
            class={cx(
              "zodiac-scroll",
              css({
                alignContent: "start",
                display: "grid",
                gap: "3",
                // Up to 50 rows: cap the sticky column at the viewport and let
                // it scroll on its own. The inset keeps focus rings unclipped.
                maxH: { lg: "[calc(100vh - var(--app-header-height) - 2rem)]" },
                mx: { lg: "-1" },
                overflowY: { lg: "auto" },
                p: { lg: "1" },
                position: { lg: "sticky" },
                top: { lg: "4" },
              }),
            )}
          >
            <p class={eyebrowClass}>Oldest first</p>
            <UIList class={queueListClass}>
              <For each={rowIds()}>
                {(draftId) => (
                  <Show when={rowsById().get(draftId)}>
                    {(draft) => (
                      <li>
                        <button
                          type="button"
                          id={queueButtonDomId(draftId)}
                          class={cx(
                            queueButtonClass,
                            activeDraftId() === draftId &&
                              activeQueueButtonClass,
                          )}
                          aria-pressed={activeDraftId() === draftId}
                          onClick={() => void selectDraft(draftId)}
                        >
                          <div class={queueRowHeaderClass}>
                            <UIBadge tone="violet">
                              {draftLabel(draft().kind)}
                            </UIBadge>
                            <DateTime
                              class={metaLabelClass}
                              value={draft().createdAt}
                              format="datetime"
                            />
                          </div>
                          <p class={queueStatementClass}>
                            {queueStatement(draft())}
                          </p>
                          <span class={metaLabelClass}>
                            {queueContextLabel(draft())}
                          </span>
                        </button>
                      </li>
                    )}
                  </Show>
                )}
              </For>
            </UIList>
          </aside>

          <UICard
            ref={(element: HTMLElement) => {
              reviewPanel = element;
            }}
            class={neutralCardClass}
          >
            <UINotice
              class={leadClass}
              status={contextStatus()}
              error={contextError()}
            />
            <Show
              when={
                !context.isLoading() &&
                context.data()?.draft._id === activeDraftId() &&
                context.data()
              }
            >
              {(reviewContext) => (
                <>
                  <Show when={!reviewContext().draft.payload}>
                    <h2 class={sectionTitleClass}>
                      {reviewContext().draft.title}
                    </h2>
                  </Show>
                  <Show
                    when={reviewContext().draft.status === "pending_review"}
                    fallback={
                      <DraftReviewStory
                        context={reviewContext()}
                        payload={reviewContext().draft.payload}
                        decide={<DecisionState draft={reviewContext().draft} />}
                      />
                    }
                  >
                    <ReviewWorkspace
                      context={reviewContext()}
                      pendingDrafts={rows()}
                      onApproved={setLastPromotion}
                      onDecided={handleDecided}
                      onFocusOrphaned={focusActiveRow}
                    />
                  </Show>
                </>
              )}
            </Show>
          </UICard>
        </div>
      </Show>
    </section>
  );
}
