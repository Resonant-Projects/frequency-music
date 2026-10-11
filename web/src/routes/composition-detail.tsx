import { Link, useNavigate, useParams } from "@tanstack/solid-router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onMount,
  Show,
} from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import { entityCellClass } from "../components/entity-card";
import { createKeyedRows } from "../lib/keyed-rows";
import {
  backLink,
  badgeRowClass,
  collapsedNoticeClass,
  detailTitleClass,
  fieldLabelClass,
  goldDivider,
  helperClass,
  Markdown,
  metaLine,
  pageClass,
  proseClass,
  recordLinkClass,
  sectionLabel,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UINotice,
  UISelect,
  UITextarea,
} from "../components/ui";
import {
  createMutation,
  createQueryWithStatus,
  describeError,
  describeLoad,
} from "../integrations/convex";
import { parseLines } from "../lib/markdown-utils";
import { api } from "../../../convex/_generated/api";
import { useClerkAuthSnapshot } from "../integrations/clerk";

/** Secondary line under a lineage or source title. */
const subLineSpaced = cx(helperClass, css({ mt: "1" }));

/** A vertical stack of entity cells. */
const cellStackClass = css({ display: "grid", gap: "2" });

const violetPanelClass = css({
  bg: "zodiac.violet/7",
  borderColor: "zodiac.violet/30",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "grid",
  mt: "3",
  p: "3",
});

const extractionMetaRowClass = cx(
  badgeRowClass,
  css({ justifyContent: "space-between", mt: "2" }),
);

const correctionPanelClass = cx(violetPanelClass, css({ gap: "2" }));

const correctionNoteClass = css({ color: "zodiac.cream/68" });

const claimsFieldClass = css({ minH: "72" });

const parametersFieldClass = css({ minH: "56" });

const correctionNoticeClass = css({ mt: "2" });

const visibilityControlClass = css({ display: "grid", gap: "2", mt: "3" });

const visibilitySelectClass = css({ maxW: "52" });

const cellTitleClass = css({ color: "zodiac.cream" });

const extractionSummaryClass = css({ color: "zodiac.cream", mb: "1" });

const provenanceLabelClass = css({
  color: "zodiac.gold",
  fontSize: "sm",
  mb: "1",
});

const sessionBadgesClass = cx(badgeRowClass, css({ mb: "1" }));

const sessionFeedbackClass = css({
  color: "zodiac.cream/70",
  lineHeight: "1.7",
});

const sessionNotesClass = css({
  color: "zodiac.cream/66",
  fontSize: "sm",
  lineHeight: "1.7",
});

const spacedBelowClass = css({ mb: "2" });

const standoutListClass = css({ listStyleType: "disc", paddingLeft: "5" });

type ListeningSession = Doc<"listeningSessions">;

function hasBodyNotes(session: ListeningSession) {
  return (
    (session.feltQualities?.length ?? 0) > 0 ||
    (session.bodyMapTags?.length ?? 0) > 0 ||
    Boolean(session.bodyMapNotes)
  );
}

function hasStandoutMoments(session: ListeningSession) {
  return (session.standoutMoments?.length ?? 0) > 0;
}

function parseJsonArray<T>(value: string, label: string): T[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} is not valid JSON — expected a JSON array.`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`);
  }
  return parsed as T[];
}

function jsonArrayChanged(value: string, original: unknown[]) {
  try {
    return JSON.stringify(JSON.parse(value)) !== JSON.stringify(original);
  } catch {
    return true;
  }
}

function ExtractionCorrection(props: { extraction: Doc<"extractions"> }) {
  const editExtraction = createMutation(api.extractions.editExtraction);
  const [editMode, setEditMode] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  const [summary, setSummary] = createSignal("");
  const [claimsJson, setClaimsJson] = createSignal("");
  const [parametersJson, setParametersJson] = createSignal("");
  const [topicsText, setTopicsText] = createSignal("");
  const [questionsText, setQuestionsText] = createSignal("");
  const [confidenceText, setConfidenceText] = createSignal("");
  let summaryField: HTMLTextAreaElement | undefined;
  let correctTrigger: HTMLButtonElement | undefined;

  // Closing the panel unmounts the focused Save/Cancel button; hand focus
  // back to the always-mounted "Correct extraction" trigger that opened it.
  function closeEditor() {
    setEditMode(false);
    correctTrigger?.focus();
  }

  const originalClaimsJson = () =>
    JSON.stringify(props.extraction.claims, null, 2);
  const originalParametersJson = () =>
    JSON.stringify(props.extraction.compositionParameters, null, 2);

  const changedFields = createMemo(() => {
    if (!editMode()) return [];
    const fields: string[] = [];
    if (summary() !== props.extraction.summary) fields.push("summary");
    if (jsonArrayChanged(claimsJson(), props.extraction.claims)) {
      fields.push("claims");
    }
    if (
      jsonArrayChanged(parametersJson(), props.extraction.compositionParameters)
    ) {
      fields.push("compositionParameters");
    }
    if (
      JSON.stringify(parseLines(topicsText())) !==
      JSON.stringify(props.extraction.topics)
    ) {
      fields.push("topics");
    }
    if (
      JSON.stringify(parseLines(questionsText())) !==
      JSON.stringify(props.extraction.openQuestions)
    ) {
      fields.push("openQuestions");
    }
    const confidenceValue = confidenceText().trim();
    if (
      confidenceValue !== "" &&
      Number(confidenceValue) !== props.extraction.confidence
    ) {
      fields.push("confidence");
    }
    return fields;
  });

  function beginEdit() {
    setSummary(props.extraction.summary);
    setClaimsJson(originalClaimsJson());
    setParametersJson(originalParametersJson());
    setTopicsText(props.extraction.topics.join("\n"));
    setQuestionsText(props.extraction.openQuestions.join("\n"));
    setConfidenceText(String(props.extraction.confidence));
    setNotice(null);
    setNoticeError(null);
    setEditMode(true);
    // The trigger disables itself, so move focus into the panel it opened;
    // deferred because the summary field mounts in this same tick.
    queueMicrotask(() => summaryField?.focus());
  }

  async function saveCorrection() {
    const fields = changedFields();
    if (fields.length === 0 || saving()) return;
    setSaving(true);
    setNotice(null);
    setNoticeError(null);
    try {
      const confidenceValue = confidenceText().trim();
      const confidence =
        confidenceValue === "" ? undefined : Number(confidenceValue);
      if (
        fields.includes("confidence") &&
        (confidence === undefined || !Number.isFinite(confidence))
      ) {
        throw new Error("Confidence must be a number.");
      }
      await editExtraction({
        id: props.extraction._id,
        ...(fields.includes("summary") ? { summary: summary() } : {}),
        ...(fields.includes("claims")
          ? {
              claims: parseJsonArray<Doc<"extractions">["claims"][number]>(
                claimsJson(),
                "Claims",
              ),
            }
          : {}),
        ...(fields.includes("compositionParameters")
          ? {
              compositionParameters: parseJsonArray<
                Doc<"extractions">["compositionParameters"][number]
              >(parametersJson(), "Composition parameters"),
            }
          : {}),
        ...(fields.includes("topics")
          ? { topics: parseLines(topicsText()) }
          : {}),
        ...(fields.includes("openQuestions")
          ? { openQuestions: parseLines(questionsText()) }
          : {}),
        ...(fields.includes("confidence") && confidence !== undefined
          ? { confidence }
          : {}),
      });
      closeEditor();
      setNotice("Extraction correction saved with edit provenance.");
    } catch (error) {
      setNoticeError(describeError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div class={extractionMetaRowClass}>
        <span class={metaLine}>
          confidence {props.extraction.confidence} ·{" "}
          {props.extraction.topics.length} topics
        </span>
        <UIButton
          ref={(element) => {
            correctTrigger = element;
          }}
          variant="outline"
          disabled={editMode()}
          onClick={beginEdit}
        >
          Correct extraction
        </UIButton>
      </div>

      <Show when={editMode()}>
        <div class={correctionPanelClass}>
          <div class={badgeRowClass}>
            <For each={changedFields()}>
              {(field) => <UIBadge tone="violet">changed: {field}</UIBadge>}
            </For>
          </div>
          <p class={correctionNoteClass}>
            Saving preserves the generated and edited field sets as eval
            provenance. Claims and parameters use their stored JSON shape.
          </p>
          <label
            class={fieldLabelClass}
            for={`extraction-summary-${props.extraction._id}`}
          >
            Summary
          </label>
          <UITextarea
            ref={(element) => {
              summaryField = element;
            }}
            id={`extraction-summary-${props.extraction._id}`}
            value={summary()}
            onInput={(event) => setSummary(event.currentTarget.value)}
          />
          <label
            class={fieldLabelClass}
            for={`extraction-claims-${props.extraction._id}`}
          >
            Claims JSON
          </label>
          <UITextarea
            id={`extraction-claims-${props.extraction._id}`}
            value={claimsJson()}
            onInput={(event) => setClaimsJson(event.currentTarget.value)}
            class={claimsFieldClass}
          />
          <label
            class={fieldLabelClass}
            for={`extraction-parameters-${props.extraction._id}`}
          >
            Composition parameters JSON
          </label>
          <UITextarea
            id={`extraction-parameters-${props.extraction._id}`}
            value={parametersJson()}
            onInput={(event) => setParametersJson(event.currentTarget.value)}
            class={parametersFieldClass}
          />
          <label
            class={fieldLabelClass}
            for={`extraction-topics-${props.extraction._id}`}
          >
            Topics (one per line)
          </label>
          <UITextarea
            id={`extraction-topics-${props.extraction._id}`}
            value={topicsText()}
            onInput={(event) => setTopicsText(event.currentTarget.value)}
          />
          <label
            class={fieldLabelClass}
            for={`extraction-questions-${props.extraction._id}`}
          >
            Open questions (one per line)
          </label>
          <UITextarea
            id={`extraction-questions-${props.extraction._id}`}
            value={questionsText()}
            onInput={(event) => setQuestionsText(event.currentTarget.value)}
          />
          <label
            class={fieldLabelClass}
            for={`extraction-confidence-${props.extraction._id}`}
          >
            Confidence
          </label>
          <UIInput
            id={`extraction-confidence-${props.extraction._id}`}
            type="number"
            step="0.01"
            value={confidenceText()}
            onInput={(event) => setConfidenceText(event.currentTarget.value)}
          />
          <div class={badgeRowClass}>
            <UIButton
              variant="outline"
              aria-busy={saving()}
              disabled={changedFields().length === 0}
              onClick={saveCorrection}
            >
              {saving() ? "Saving…" : "Save correction"}
            </UIButton>
            <UIButton variant="ghost" disabled={saving()} onClick={closeEditor}>
              Cancel
            </UIButton>
          </div>
        </div>
      </Show>

      {/* An empty notice collapses itself, so the margin only shows with text. */}
      <UINotice
        class={correctionNoticeClass}
        status={notice()}
        error={noticeError()}
      />
    </>
  );
}

type Visibility = Doc<"listeningSessions">["visibility"];

function ListeningVisibilityControl(props: {
  session: Doc<"listeningSessions">;
}) {
  const auth = useClerkAuthSnapshot();
  const updateVisibility = createMutation(api.listening.updateVisibility);
  const [visibility, setVisibility] = createSignal<Visibility>(
    props.session.visibility,
  );
  const [saving, setSaving] = createSignal(false);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  // Keep the select synced to the source of truth when the query refreshes
  // the session (e.g. after a successful mutation).
  createEffect(
    on(
      () => props.session.visibility,
      (next) => setVisibility(next),
      { defer: true },
    ),
  );
  const authBypass = import.meta.env.VITE_AUTH_BYPASS === "1";
  const canEdit = createMemo(
    () =>
      !authBypass &&
      auth().userId !== null &&
      auth().userId === String(props.session.createdBy),
  );

  async function saveVisibility() {
    if (saving() || visibility() === props.session.visibility) return;
    setSaving(true);
    setNotice(null);
    setNoticeError(null);
    try {
      await updateVisibility({
        id: props.session._id,
        visibility: visibility(),
      });
      setNotice(`Visibility set to ${visibility()}.`);
    } catch (error) {
      setNoticeError(describeError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class={visibilityControlClass}>
      <label
        class={fieldLabelClass}
        for={`listening-visibility-${props.session._id}`}
      >
        Session visibility
      </label>
      <div class={badgeRowClass}>
        <UISelect
          id={`listening-visibility-${props.session._id}`}
          value={visibility()}
          disabled={!canEdit()}
          onChange={(event) =>
            setVisibility(event.currentTarget.value as Visibility)
          }
          class={visibilitySelectClass}
        >
          <option value="private">Private</option>
          <option value="followers">Followers</option>
          <option value="public">Public</option>
        </UISelect>
        {/* Outline, not solid: one of these renders per listening session.
            While unchanged it is `aria-disabled` rather than `disabled`, so a
            successful save does not blur the button the user just pressed. */}
        <UIButton
          variant="outline"
          disabled={!canEdit()}
          aria-disabled={
            visibility() === props.session.visibility ? true : undefined
          }
          aria-busy={saving()}
          onClick={saveVisibility}
        >
          {saving() ? "Saving…" : "Confirm visibility"}
        </UIButton>
      </div>
      <Show when={!canEdit()}>
        <p class={metaLine}>
          Visibility is read-only here because the existing mutation is limited
          to the session creator.
        </p>
      </Show>
      <UINotice status={notice()} error={noticeError()} />
    </div>
  );
}

export function CompositionDetailPage() {
  const params = useParams({ from: "/compositions/$compositionId" });
  const navigate = useNavigate();
  const lineageQuery = createQueryWithStatus(
    api.compositions.getLineage,
    () => ({
      id: params().compositionId as Id<"compositions">,
    }),
  );
  const lineage = lineageQuery.data;
  const deleteComposition = createMutation(api.compositions.deleteById);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);

  onMount(() => {
    document.title = "Composition — Frequency Music";
  });

  // Lineage links navigate composition→composition without unmounting, so
  // per-composition dialog state must reset on the route param.
  createEffect(
    on(
      () => params().compositionId,
      () => {
        setDeleteConfirmOpen(false);
        setDeleting(false);
        setDeleteError(null);
      },
      { defer: true },
    ),
  );
  let deleteConfirmButton: HTMLButtonElement | undefined;
  let deleteTrigger: HTMLButtonElement | undefined;

  function closeDeleteConfirm() {
    setDeleteConfirmOpen(false);
    deleteTrigger?.focus();
  }

  async function handleDeleteComposition() {
    const row = lineage()?.composition;
    if (!row || deleting()) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteComposition({ id: row._id });
      void navigate({ to: "/compositions" });
    } catch (error) {
      setDeleteError(describeError(error));
    } finally {
      setDeleting(false);
    }
  }

  const load = describeLoad(lineageQuery, "composition");

  createEffect(() => {
    const row = lineage()?.composition;
    if (row) document.title = `${row.title} — Frequency Music`;
  });

  createEffect(() => {
    // Deferred: the confirm button mounts in the same tick that opens the panel.
    if (deleteConfirmOpen()) {
      queueMicrotask(() => deleteConfirmButton?.focus());
    }
  });

  return (
    <section class={pageClass}>
      <div>
        <Link to="/compositions" class={backLink}>
          <span aria-hidden="true">&larr;</span> Compositions
        </Link>
      </div>

      <UICard class={lineage() ? collapsedNoticeClass : undefined}>
        <UINotice status={load.status()} error={load.error()} />
      </UICard>

      <Show when={lineage()}>
        {(row) => {
          // Keyed by id: a correction or visibility save refreshes the lineage
          // with fresh objects, and the control that must take focus back
          // (or show the confirmation) has to survive that refresh.
          const extractionRows = createKeyedRows(
            () => row().extractions,
            (extraction) => extraction._id,
          );
          const sessionRows = createKeyedRows(
            () => row().listeningSessions,
            (session) => session._id,
          );
          return (
            <UICard>
              <div class={cx(badgeRowClass, css({ mb: "2" }))}>
                <UIBadge tone="gold">{row().composition.status}</UIBadge>
                <UIBadge tone="violet">
                  {row().composition.artifactType}
                </UIBadge>
                <UIBadge tone="cream">{row().composition.version}</UIBadge>
                <Show when={row().summary.localFailureStatus}>
                  {(status) => (
                    <UIBadge tone="cream">local: {status()}</UIBadge>
                  )}
                </Show>
                <Show when={row().summary.branchFailureStatus}>
                  {(status) => (
                    <UIBadge tone="cream">branch: {status()}</UIBadge>
                  )}
                </Show>
              </div>

              <h1 class={detailTitleClass}>{row().composition.title}</h1>

              <div class={css({ display: "flex", gap: "2", mt: "3" })}>
                <UIButton
                  ref={(element) => {
                    deleteTrigger = element;
                  }}
                  variant="outline"
                  disabled={deleting()}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteConfirmOpen(true);
                  }}
                >
                  Delete composition
                </UIButton>
              </div>

              <Show when={deleteConfirmOpen()}>
                <div
                  role="alertdialog"
                  aria-modal="false"
                  aria-label="Confirm composition deletion"
                  onKeyDown={(event) => {
                    if (event.key !== "Escape" || deleting()) return;
                    event.preventDefault();
                    closeDeleteConfirm();
                  }}
                  class={cx(violetPanelClass, css({ gap: "3" }))}
                >
                  <p class={css({ color: "zodiac.cream/74" })}>
                    Delete “{row().composition.title}”? This uses the existing
                    composition deletion path and cannot be undone from this
                    screen.
                  </p>
                  <div class={badgeRowClass}>
                    <UIButton
                      ref={(element) => {
                        deleteConfirmButton = element;
                      }}
                      variant="solid"
                      aria-busy={deleting()}
                      onClick={handleDeleteComposition}
                    >
                      {deleting() ? "Deleting…" : "Confirm delete"}
                    </UIButton>
                    <UIButton
                      variant="ghost"
                      disabled={deleting()}
                      onClick={closeDeleteConfirm}
                    >
                      Cancel
                    </UIButton>
                  </div>
                  <UINotice error={deleteError()} />
                </div>
              </Show>

              <p
                class={css({
                  color: "zodiac.cream/66",
                  fontSize: "sm",
                  lineHeight: "1.7",
                })}
              >
                Depth {row().summary.depth} in revision branch
                <Show when={row().summary.revisionVariable}>
                  {(variable) => <> · changed variable: {variable()}</>}
                </Show>
                <Show when={row().summary.latestExpandVerdict}>
                  {(verdict) => <> · latest expand verdict: {verdict()}</>}
                </Show>
              </p>

              <Show
                when={
                  row().summary.localFailureStatus ||
                  row().summary.branchFailureStatus
                }
              >
                <hr class={goldDivider} />
                <h2 class={sectionLabel}>Archive Signal</h2>
                <Show when={row().summary.localFailureStatus}>
                  {(status) => (
                    <p class={cx(proseClass, css({ mb: "2" }))}>
                      This composition is currently classified locally as{" "}
                      <code>{status()}</code> based on its own listening
                      history.
                    </p>
                  )}
                </Show>
                <Show when={row().summary.branchFailureStatus}>
                  {(status) => (
                    <p class={proseClass}>
                      This revision branch is currently classified as{" "}
                      <code>{status()}</code> in the derived failure archive.
                    </p>
                  )}
                </Show>
              </Show>

              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Lineage</h2>
              <div class={cellStackClass}>
                <For each={row().ancestry}>
                  {(ancestor) => (
                    <div class={entityCellClass}>
                      <Link
                        to="/compositions/$compositionId"
                        params={{ compositionId: String(ancestor._id) }}
                        class={recordLinkClass}
                      >
                        {ancestor.title}
                      </Link>
                      <p class={subLineSpaced}>
                        {ancestor.version}
                        <Show when={ancestor.revisionVariable}>
                          {(variable) => <> · variable: {variable()}</>}
                        </Show>
                      </p>
                    </div>
                  )}
                </For>
                <div class={entityCellClass}>
                  <div class={css({ color: "zodiac.gold" })}>
                    {row().composition.title}
                  </div>
                  <p class={subLineSpaced}>current node</p>
                </div>
              </div>

              <Show when={row().children.length > 0}>
                <hr class={goldDivider} />
                <h2 class={sectionLabel}>Direct Revisions</h2>
                <div class={cellStackClass}>
                  <For each={row().children}>
                    {(child) => (
                      <div class={entityCellClass}>
                        <Link
                          to="/compositions/$compositionId"
                          params={{ compositionId: String(child._id) }}
                          class={recordLinkClass}
                        >
                          {child.title}
                        </Link>
                        <p class={subLineSpaced}>
                          {child.version}
                          <Show when={child.revisionVariable}>
                            {(variable) => <> · variable: {variable()}</>}
                          </Show>
                        </p>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Provenance</h2>
              <div class={css({ display: "grid", gap: "3" })}>
                <Show when={row().recipe}>
                  {(recipe) => (
                    <div class={entityCellClass}>
                      <h3 class={provenanceLabelClass}>Recipe</h3>
                      <Link
                        to="/recipes/$recipeId"
                        params={{ recipeId: String(recipe()._id) }}
                        class={recordLinkClass}
                      >
                        {recipe().title}
                      </Link>
                    </div>
                  )}
                </Show>
                <Show when={row().hypothesis}>
                  {(hypothesis) => (
                    <div class={entityCellClass}>
                      <h3 class={provenanceLabelClass}>Hypothesis</h3>
                      <Link
                        to="/hypotheses/$hypothesisId"
                        params={{ hypothesisId: String(hypothesis()._id) }}
                        class={recordLinkClass}
                      >
                        {hypothesis().title}
                      </Link>
                    </div>
                  )}
                </Show>
                <Show when={row().thesis}>
                  {(thesis) => (
                    <div class={entityCellClass}>
                      <h3 class={provenanceLabelClass}>Thesis</h3>
                      <Link
                        to="/theses/$thesisId"
                        params={{ thesisId: String(thesis()._id) }}
                        class={recordLinkClass}
                      >
                        {thesis().title}
                      </Link>
                    </div>
                  )}
                </Show>
              </div>

              <Show when={row().sources.length > 0}>
                <hr class={goldDivider} />
                <h2 class={sectionLabel}>Linked Sources</h2>
                <div class={cellStackClass}>
                  <For each={row().sources}>
                    {(source) => (
                      <div class={entityCellClass}>
                        <div class={cellTitleClass}>
                          {source.title ?? "Untitled source"}
                        </div>
                        <p class={subLineSpaced}>{source.type}</p>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={row().extractions.length > 0}>
                <hr class={goldDivider} />
                <h2 class={sectionLabel}>Extractions</h2>
                <div class={cellStackClass}>
                  <For each={extractionRows.ids()}>
                    {(id) => (
                      <Show when={extractionRows.byId().get(id)}>
                        {(extraction) => (
                          <div class={entityCellClass}>
                            <div class={extractionSummaryClass}>
                              {extraction().summary}
                            </div>
                            <p class={helperClass}>
                              {extraction().claims.length} claims ·{" "}
                              {extraction().compositionParameters.length}{" "}
                              parameters
                            </p>
                            <ExtractionCorrection extraction={extraction()} />
                          </div>
                        )}
                      </Show>
                    )}
                  </For>
                </div>
              </Show>

              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Listening History</h2>
              <Show
                when={row().listeningSessions.length > 0}
                fallback={
                  <p class={helperClass}>
                    No listening sessions logged for this composition yet.
                  </p>
                }
              >
                <div class={cellStackClass}>
                  <For each={sessionRows.ids()}>
                    {(id) => (
                      <Show when={sessionRows.byId().get(id)}>
                        {(session) => (
                          <div class={entityCellClass}>
                            <div class={sessionBadgesClass}>
                              <Show when={session().expandVerdict}>
                                {(verdict) => (
                                  <UIBadge tone="gold">{verdict()}</UIBadge>
                                )}
                              </Show>
                              <Show
                                when={
                                  session().ratings.expandability !== undefined
                                }
                              >
                                {(score) => (
                                  <UIBadge tone="cream">
                                    expandability {score()}
                                  </UIBadge>
                                )}
                              </Show>
                            </div>
                            <div
                              class={cx(
                                sessionFeedbackClass,
                                (hasBodyNotes(session()) ||
                                  hasStandoutMoments(session())) &&
                                  spacedBelowClass,
                              )}
                            >
                              <Markdown content={session().feedbackMd} />
                            </div>
                            <Show when={hasBodyNotes(session())}>
                              <div
                                class={cx(
                                  sessionNotesClass,
                                  hasStandoutMoments(session()) &&
                                    spacedBelowClass,
                                )}
                              >
                                <Show
                                  when={
                                    (session().feltQualities?.length ?? 0) > 0
                                  }
                                >
                                  <p>
                                    Felt: {session().feltQualities?.join(", ")}
                                  </p>
                                </Show>
                                <Show
                                  when={
                                    (session().bodyMapTags?.length ?? 0) > 0
                                  }
                                >
                                  <p>
                                    Body map:{" "}
                                    {session().bodyMapTags?.join(", ")}
                                  </p>
                                </Show>
                                <Show when={session().bodyMapNotes}>
                                  {(value) => <p>Body notes: {value()}</p>}
                                </Show>
                              </div>
                            </Show>
                            <Show when={hasStandoutMoments(session())}>
                              <div class={sessionNotesClass}>
                                <p>Standout moments:</p>
                                <ul class={standoutListClass}>
                                  <For each={session().standoutMoments}>
                                    {(moment) => <li>{moment}</li>}
                                  </For>
                                </ul>
                              </div>
                            </Show>
                            <ListeningVisibilityControl session={session()} />
                          </div>
                        )}
                      </Show>
                    )}
                  </For>
                </div>
              </Show>
            </UICard>
          );
        }}
      </Show>
    </section>
  );
}
