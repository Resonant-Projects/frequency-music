import { Link } from "@tanstack/solid-router";
import type { FunctionReturnType } from "convex/server";
import { createUniqueId, For, type JSX, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type {
  HypothesisDraftPayload,
  RecipeDraftPayload,
} from "../../../convex/shared/draftPayloads";
import { css, cx } from "../../styled-system/css";
import {
  badgeRowClass,
  eyebrowClass,
  fieldLabelClass,
  helperClass,
  inlineActionLink,
  jsonBlockClass,
  metaLabelClass,
  srOnlyClass,
  UIBadge,
  UIInput,
  UIList,
  UITextarea,
} from "./ui";

// ---------------------------------------------------------------------------
// Shared types + rendering for agent human-review drafts. These mirror the
// server-side summarizeAgentReviewDraft() shape (convex/agentDrafts.ts) and the
// structured payload validators (convex/schema.ts). Kept in one place so the
// pending-queue route and the run-detail route render drafts identically.
// ---------------------------------------------------------------------------

export type AgentDraftKind = "hypothesis_draft" | "recipe_draft";
export type AgentDraftStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "superseded";

export type AgentDraftPayload = HypothesisDraftPayload | RecipeDraftPayload;
export type { HypothesisDraftPayload, RecipeDraftPayload };
export type DraftReviewContext = FunctionReturnType<
  typeof api.agentDrafts.getReviewContext
>;

export type PersistedReviewDraft = {
  _id: Id<"agentReviewDrafts">;
  _creationTime: number;
  agentRunId: Id<"agentRuns">;
  graphName: string;
  kind: AgentDraftKind;
  title: string;
  summary: string;
  candidateIds: string[];
  status: AgentDraftStatus;
  createdAt: number;
  updatedAt: number;
  payload?: AgentDraftPayload;
  amendedPayload?: AgentDraftPayload;
  reviewPair?: { conceptA: string; conceptB: string };
  decidedAt?: number;
  decidedBy?: "human";
  decisionNote?: string;
  decisionSource?: DraftReviewContext["draft"]["decisionSource"];
  decisionTranscript?: DraftReviewContext["draft"]["decisionTranscript"];
  decisionIntentId?: DraftReviewContext["draft"]["decisionIntentId"];
  promotedId?: string;
};

export function draftLabel(kind: AgentDraftKind | "dry_run_summary") {
  if (kind === "hypothesis_draft") return "Hypothesis Draft";
  if (kind === "recipe_draft") return "Recipe Draft";
  return "Dry-Run Summary";
}

export function statusTone(
  status: AgentDraftStatus,
): "gold" | "violet" | "cream" {
  if (status === "pending_review") return "violet";
  if (status === "approved") return "gold";
  return "cream";
}

const monoValueClass = css({
  color: "zodiac.cream/72",
  fontFamily: "mono",
  fontSize: "xs",
  lineHeight: "dense",
});

const bodyValueClass = css({
  color: "zodiac.cream",
  lineHeight: "prose",
  maxW: "measure",
});

function PayloadField(props: { label: string; children: JSX.Element }) {
  return (
    <div>
      <div class={fieldLabelClass}>{props.label}</div>
      <div class={css({ mt: "1" })}>{props.children}</div>
    </div>
  );
}

function HypothesisPreview(props: { payload: HypothesisDraftPayload }) {
  return (
    <>
      <PayloadField label="Statement">
        <p class={bodyValueClass}>{props.payload.statement}</p>
      </PayloadField>
      <PayloadField label="Rationale">
        <p class={bodyValueClass}>{props.payload.rationale}</p>
      </PayloadField>
      <PayloadField label="Why This Matters">
        <p class={bodyValueClass}>{props.payload.whyThisMatters}</p>
      </PayloadField>
      <Show when={props.payload.confidence !== undefined}>
        <PayloadField label="Confidence">
          <p class={monoValueClass}>{props.payload.confidence}</p>
        </PayloadField>
      </Show>
      <Show when={(props.payload.concepts ?? []).length > 0}>
        <PayloadField label="Concepts">
          <div class={badgeRowClass}>
            <For each={props.payload.concepts ?? []}>
              {(concept) => <UIBadge tone="cream">{concept}</UIBadge>}
            </For>
          </div>
        </PayloadField>
      </Show>
      <Show when={props.payload.sourceIds.length > 0}>
        <PayloadField label="Source IDs">
          <div class={badgeRowClass}>
            <For each={props.payload.sourceIds}>
              {(id) => <UIBadge tone="cream">{id}</UIBadge>}
            </For>
          </div>
        </PayloadField>
      </Show>
      <Show when={props.payload.extractionIds.length > 0}>
        <PayloadField label="Extraction IDs">
          <div class={badgeRowClass}>
            <For each={props.payload.extractionIds}>
              {(id) => <UIBadge tone="cream">{id}</UIBadge>}
            </For>
          </div>
        </PayloadField>
      </Show>
      <Show when={props.payload.thesisId}>
        {(thesisId) => (
          <PayloadField label="Thesis ID">
            <p class={monoValueClass}>{thesisId()}</p>
          </PayloadField>
        )}
      </Show>
    </>
  );
}

function RecipePreview(props: { payload: RecipeDraftPayload }) {
  return (
    <>
      <PayloadField label="Recipe Title">
        <p class={bodyValueClass}>{props.payload.title}</p>
      </PayloadField>
      <PayloadField label="Why This Matters">
        <p class={bodyValueClass}>{props.payload.whyThisMatters}</p>
      </PayloadField>
      <Show when={props.payload.parameters.length > 0}>
        <PayloadField label="Parameters">
          <div class={css({ display: "grid", gap: "1" })}>
            <For each={props.payload.parameters}>
              {(param) => (
                <div class={monoValueClass}>
                  {param.type ?? param.kind ?? "param"}: {param.value}
                </div>
              )}
            </For>
          </div>
        </PayloadField>
      </Show>
      <Show when={props.payload.bodyMd}>
        {(bodyMd) => (
          <PayloadField label="Body">
            <p class={bodyValueClass}>{bodyMd()}</p>
          </PayloadField>
        )}
      </Show>
      <Show when={(props.payload.dawChecklist ?? []).length > 0}>
        <PayloadField label="DAW Checklist">
          <div class={css({ display: "grid", gap: "1" })}>
            <For each={props.payload.dawChecklist ?? []}>
              {(item) => <div class={monoValueClass}>{item}</div>}
            </For>
          </div>
        </PayloadField>
      </Show>
      <Show when={props.payload.instrumentationNotes}>
        {(notes) => (
          <PayloadField label="Instrumentation Notes">
            <p class={bodyValueClass}>{notes()}</p>
          </PayloadField>
        )}
      </Show>
      <Show when={props.payload.protocol}>
        {(protocol) => (
          <PayloadField label="Protocol">
            <pre
              role="group"
              aria-label="Recipe protocol JSON"
              tabIndex={0}
              class={cx("zodiac-scroll", jsonBlockClass)}
            >
              {JSON.stringify(protocol(), null, 2)}
            </pre>
          </PayloadField>
        )}
      </Show>
    </>
  );
}

/** Renders a human-readable preview of a draft's structured promotion payload. */
export function DraftPayloadPreview(props: {
  kind: AgentDraftKind;
  payload?: AgentDraftPayload;
}) {
  return (
    <Show
      when={props.payload}
      fallback={
        <p class={helperClass}>
          No structured payload — this draft is acknowledge-only and cannot be
          promoted into a hypothesis or recipe.
        </p>
      }
    >
      {(payload) => (
        <div class={css({ display: "grid", gap: "3" })}>
          <Show when={props.kind === "hypothesis_draft"}>
            <HypothesisPreview payload={payload() as HypothesisDraftPayload} />
          </Show>
          <Show when={props.kind === "recipe_draft"}>
            <RecipePreview payload={payload() as RecipeDraftPayload} />
          </Show>
        </div>
      )}
    </Show>
  );
}

const reviewSectionClass = css({
  borderTopColor: "zodiac.cream/12",
  borderTopWidth: "1px",
  display: "grid",
  gap: "3",
  pt: "5",
});

/** The `<summary>` face shared by every disclosure in the review story. */
const disclosureSummaryClass = css({
  color: "zodiac.cream/72",
  cursor: "pointer",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "label",
  minHeight: "7",
  py: "2",
  textTransform: "uppercase",
  _coarsePointer: {
    minHeight: "11",
    py: "3",
  },
});

/**
 * A link whose label is a source title: `inlineActionLink`'s gold mono face in
 * sentence case, since an uppercased title would misquote the source.
 */
const sourceLinkClass = css({
  alignItems: "center",
  color: "zodiac.gold",
  display: "inline-flex",
  fontFamily: "mono",
  fontSize: "xs",
  gap: "1.5",
  minH: "6",
  textDecoration: "none",
  _hover: { textDecoration: "underline" },
  _coarsePointer: { minH: "11" },
});

const evidenceListClass = css({ display: "grid", gap: "3" });
const priorWorkListClass = css({ display: "grid", gap: "2" });

const evidenceItemClass = css({
  borderLeftWidth: "3px",
  borderRadius: "l2",
  display: "grid",
  gap: "2",
  p: "3",
});

/** Contradicting evidence is lifted in violet so it cannot be skimmed past. */
const evidenceToneClass = {
  contradicts: css({ bg: "zodiac.violet/14", borderColor: "zodiac.violet/56" }),
  other: css({ bg: "zodiac.cream/3.5", borderColor: "zodiac.cream/12" }),
};

const stanceGlyphClass = {
  contradicts: css({ color: "zodiac.error" }),
  supports: css({ color: "zodiac.success" }),
  other: css({ color: "zodiac.cream/66" }),
};

const priorHypothesisClass = css({
  borderColor: "zodiac.cream/12",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "grid",
  gap: "2",
  p: "3",
});

const failureHitClass = css({
  bg: "zodiac.violet/10",
  borderColor: "zodiac.violet/32",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "grid",
  gap: "2",
  p: "3",
});

const conceptPanelClass = css({
  bg: "zodiac.glow-inner/34",
  borderColor: "zodiac.violet/20",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "grid",
  gap: "2",
  p: "3",
});

/** The violet panel that holds the edit-mode fields. */
const editPanelClass = css({
  bg: "zodiac.violet/8",
  borderColor: "zodiac.violet/32",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "grid",
  gap: "3",
  p: "3",
});

const reviewHeadingClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "xl", md: "2xl" },
  fontWeight: "normal",
  lineHeight: "display",
});

const reviewBodyClass = css({
  color: "zodiac.cream/82",
  fontFamily: "display",
  fontSize: "lg",
  lineHeight: "prose",
  maxW: "measure",
});

/** A disclosure's revealed paragraph, set off from its `<summary>`. */
const disclosureBodyClass = cx(reviewBodyClass, css({ mt: "3" }));

function ReviewSection(props: {
  index: number;
  label: string;
  children: JSX.Element;
}) {
  const headingId = createUniqueId();
  return (
    <section class={reviewSectionClass} aria-labelledby={headingId}>
      <h2 class={metaLabelClass} id={headingId}>
        {String(props.index).padStart(2, "0")} · {props.label}
      </h2>
      {props.children}
    </section>
  );
}

function ConceptPanel(props: {
  concept: NonNullable<DraftReviewContext["correspondence"]>["conceptA"];
}) {
  return (
    <div class={conceptPanelClass}>
      <h4 class={reviewHeadingClass}>{props.concept.displayName}</h4>
      <div class={badgeRowClass}>
        <For each={props.concept.domains}>
          {(domain) => <UIBadge tone="violet">{domain}</UIBadge>}
        </For>
      </div>
      <Show when={props.concept.description}>
        {(description) => <p class={reviewBodyClass}>{description()}</p>}
      </Show>
    </div>
  );
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function EditableTextField(props: {
  id: string;
  label: string;
  value: string;
  multiline?: boolean;
  onInput: (value: string) => void;
}) {
  return (
    <div class={css({ display: "grid", gap: "2" })}>
      <label class={fieldLabelClass} for={props.id}>
        {props.label}
      </label>
      <Show
        when={props.multiline}
        fallback={
          <UIInput
            id={props.id}
            value={props.value}
            onInput={(event) => props.onInput(event.currentTarget.value)}
          />
        }
      >
        <UITextarea
          id={props.id}
          value={props.value}
          onInput={(event) => props.onInput(event.currentTarget.value)}
        />
      </Show>
    </div>
  );
}

/** The plan-07 five-section reading order for a single review decision. */
export function DraftReviewStory(props: {
  context: DraftReviewContext;
  payload?: AgentDraftPayload;
  editMode?: boolean;
  onPayloadChange?: (payload: AgentDraftPayload) => void;
  decide: JSX.Element;
}) {
  const payload = () => props.payload ?? props.context.draft.payload;
  const hypothesisPayload = () =>
    props.context.draft.kind === "hypothesis_draft"
      ? (payload() as HypothesisDraftPayload | undefined)
      : undefined;
  const recipePayload = () =>
    props.context.draft.kind === "recipe_draft"
      ? (payload() as RecipeDraftPayload | undefined)
      : undefined;
  const hasPriorWork = () =>
    props.context.related.priorHypotheses.length > 0 ||
    props.context.related.failures.length > 0;

  return (
    <article class={css({ display: "grid", gap: "5" })}>
      <ReviewSection index={1} label="The claim being made">
        <Show
          when={props.context.correspondence}
          fallback={
            <div class={css({ display: "grid", gap: "2" })}>
              <UIBadge tone="cream">Legacy draft</UIBadge>
              <p class={reviewBodyClass}>
                No correspondence lineage was recorded for this draft.
              </p>
            </div>
          }
        >
          {(correspondence) => (
            <div class={css({ display: "grid", gap: "4" })}>
              <div
                class={css({
                  alignItems: "flex-start",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "3",
                  justifyContent: "space-between",
                })}
              >
                <h3 class={reviewHeadingClass}>
                  {correspondence().row.statement}
                </h3>
                <UIBadge tone="cream">{correspondence().row.status}</UIBadge>
              </div>
              <Show
                when={
                  correspondence().row.similarityScore !== undefined ||
                  correspondence().row.noveltyScore !== undefined
                }
              >
                <p class={metaLabelClass}>
                  {correspondence().row.similarityScore !== undefined
                    ? `Similarity ${Math.round((correspondence().row.similarityScore ?? 0) * 100)}%`
                    : ""}
                  {correspondence().row.similarityScore !== undefined &&
                  correspondence().row.noveltyScore !== undefined
                    ? " · "
                    : ""}
                  {correspondence().row.noveltyScore !== undefined
                    ? `Novelty ${Math.round((correspondence().row.noveltyScore ?? 0) * 100)}%`
                    : ""}
                </p>
              </Show>
              <div
                class={css({
                  display: "grid",
                  gap: "3",
                  gridTemplateColumns: {
                    base: "minmax(0, 1fr)",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                })}
              >
                <ConceptPanel concept={correspondence().conceptA} />
                <ConceptPanel concept={correspondence().conceptB} />
              </div>
              <details>
                <summary class={disclosureSummaryClass}>
                  Correspondence rationale
                </summary>
                <p class={disclosureBodyClass}>
                  {correspondence().row.rationaleMd}
                </p>
              </details>
            </div>
          )}
        </Show>
      </ReviewSection>

      <ReviewSection index={2} label="The evidence">
        <Show
          when={(props.context.correspondence?.evidence.length ?? 0) > 0}
          fallback={<p class={reviewBodyClass}>No evidence is attached.</p>}
        >
          <UIList class={evidenceListClass}>
            <For each={props.context.correspondence?.evidence ?? []}>
              {(evidence) => {
                // Persisted review context can contain the legacy neutral value
                // even though current correspondence writes use the narrower enum.
                const stance = String(evidence.stance);
                const supports = stance === "supports";
                const contradicts = stance === "contradicts";
                return (
                  <li
                    class={cx(
                      evidenceItemClass,
                      contradicts
                        ? evidenceToneClass.contradicts
                        : evidenceToneClass.other,
                    )}
                  >
                    <div class={badgeRowClass}>
                      <span
                        aria-hidden="true"
                        class={
                          contradicts
                            ? stanceGlyphClass.contradicts
                            : supports
                              ? stanceGlyphClass.supports
                              : stanceGlyphClass.other
                        }
                      >
                        {contradicts ? "⊘" : supports ? "✓" : "—"}
                      </span>
                      <UIBadge tone={contradicts ? "violet" : "cream"}>
                        {stance}
                      </UIBadge>
                      <span class={metaLabelClass}>
                        {humanize(evidence.claim.evidenceLevel)}
                        {evidence.claim.truthConfidence
                          ? ` · ${humanize(evidence.claim.truthConfidence)} confidence`
                          : ""}
                      </span>
                    </div>
                    <p class={reviewBodyClass}>{evidence.claim.text}</p>
                    <Show
                      when={evidence.sourceUrl}
                      fallback={
                        <span class={metaLabelClass}>
                          {evidence.sourceTitle}
                        </span>
                      }
                    >
                      {(sourceUrl) => (
                        <a
                          class={sourceLinkClass}
                          href={sourceUrl()}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {evidence.sourceTitle}{" "}
                          <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </Show>
                  </li>
                );
              }}
            </For>
          </UIList>
        </Show>
      </ReviewSection>

      <ReviewSection index={3} label="The proposed hypothesis">
        <Show when={hypothesisPayload()}>
          {(draftPayload) => (
            <div class={css({ display: "grid", gap: "4" })}>
              <Show
                when={props.editMode}
                fallback={
                  <>
                    <div>
                      <p class={eyebrowClass}>Title</p>
                      <h3 class={reviewHeadingClass}>{draftPayload().title}</h3>
                    </div>
                    <div>
                      <p class={eyebrowClass}>Question</p>
                      <p class={reviewBodyClass}>{draftPayload().question}</p>
                    </div>
                    <div>
                      <p class={eyebrowClass}>Statement</p>
                      <p class={reviewBodyClass}>{draftPayload().statement}</p>
                    </div>
                    <div>
                      <p class={eyebrowClass}>Why this matters</p>
                      <p class={reviewBodyClass}>
                        {draftPayload().whyThisMatters}
                      </p>
                    </div>
                  </>
                }
              >
                <div class={editPanelClass}>
                  <h3 class={srOnlyClass}>{draftPayload().title}</h3>
                  <UIBadge tone="violet">Edit mode</UIBadge>
                  <EditableTextField
                    id={`edit-title-${props.context.draft._id}`}
                    label="Title"
                    value={draftPayload().title}
                    onInput={(title) =>
                      props.onPayloadChange?.({ ...draftPayload(), title })
                    }
                  />
                  <EditableTextField
                    id={`edit-question-${props.context.draft._id}`}
                    label="Question"
                    value={draftPayload().question}
                    multiline
                    onInput={(question) =>
                      props.onPayloadChange?.({ ...draftPayload(), question })
                    }
                  />
                  <EditableTextField
                    id={`edit-statement-${props.context.draft._id}`}
                    label="Statement"
                    value={draftPayload().statement}
                    multiline
                    onInput={(statement) =>
                      props.onPayloadChange?.({ ...draftPayload(), statement })
                    }
                  />
                  <EditableTextField
                    id={`edit-why-${props.context.draft._id}`}
                    label="Why this matters"
                    value={draftPayload().whyThisMatters}
                    multiline
                    onInput={(whyThisMatters) =>
                      props.onPayloadChange?.({
                        ...draftPayload(),
                        whyThisMatters,
                      })
                    }
                  />
                </div>
              </Show>
              <details>
                <summary class={disclosureSummaryClass}>
                  Draft rationale
                </summary>
                <p class={disclosureBodyClass}>{draftPayload().rationale}</p>
              </details>
            </div>
          )}
        </Show>
        <Show when={recipePayload()}>
          {(draftPayload) => (
            <div class={css({ display: "grid", gap: "4" })}>
              <Show
                when={props.editMode}
                fallback={
                  <>
                    <div>
                      <p class={eyebrowClass}>Recipe title</p>
                      <h3 class={reviewHeadingClass}>{draftPayload().title}</h3>
                    </div>
                    <div>
                      <p class={eyebrowClass}>Why this matters</p>
                      <p class={reviewBodyClass}>
                        {draftPayload().whyThisMatters}
                      </p>
                    </div>
                    <DraftPayloadPreview
                      kind="recipe_draft"
                      payload={draftPayload()}
                    />
                  </>
                }
              >
                <div class={editPanelClass}>
                  <h3 class={srOnlyClass}>{draftPayload().title}</h3>
                  <UIBadge tone="violet">Edit mode</UIBadge>
                  <EditableTextField
                    id={`edit-title-${props.context.draft._id}`}
                    label="Recipe title"
                    value={draftPayload().title}
                    onInput={(title) =>
                      props.onPayloadChange?.({ ...draftPayload(), title })
                    }
                  />
                  <EditableTextField
                    id={`edit-why-${props.context.draft._id}`}
                    label="Why this matters"
                    value={draftPayload().whyThisMatters}
                    multiline
                    onInput={(whyThisMatters) =>
                      props.onPayloadChange?.({
                        ...draftPayload(),
                        whyThisMatters,
                      })
                    }
                  />
                  <EditableTextField
                    id={`edit-body-${props.context.draft._id}`}
                    label="Recipe body"
                    value={draftPayload().bodyMd ?? ""}
                    multiline
                    onInput={(bodyMd) =>
                      props.onPayloadChange?.({ ...draftPayload(), bodyMd })
                    }
                  />
                  <EditableTextField
                    id={`edit-instrumentation-${props.context.draft._id}`}
                    label="Instrumentation notes"
                    value={draftPayload().instrumentationNotes ?? ""}
                    multiline
                    onInput={(instrumentationNotes) =>
                      props.onPayloadChange?.({
                        ...draftPayload(),
                        instrumentationNotes,
                      })
                    }
                  />
                  <EditableTextField
                    id={`edit-checklist-${props.context.draft._id}`}
                    label="DAW checklist (one item per line)"
                    value={(draftPayload().dawChecklist ?? []).join("\n")}
                    multiline
                    onInput={(value) =>
                      props.onPayloadChange?.({
                        ...draftPayload(),
                        dawChecklist: value.split("\n"),
                      })
                    }
                  />
                </div>
              </Show>
            </div>
          )}
        </Show>
        <Show when={!payload()}>
          <p class={reviewBodyClass}>
            This legacy draft has no structured payload and cannot be promoted.
          </p>
        </Show>
        <div class={css({ display: "flex", flexWrap: "wrap", gap: "3" })}>
          <Link
            to="/agent-runs/$runId"
            params={{ runId: String(props.context.runTrace.runId) }}
            class={inlineActionLink}
          >
            Open run <span aria-hidden="true">↗</span>
          </Link>
          <Show when={props.context.runTrace.traceUrl}>
            {(traceUrl) => (
              <a
                class={inlineActionLink}
                href={traceUrl()}
                target="_blank"
                rel="noreferrer"
              >
                Open trace <span aria-hidden="true">↗</span>
              </a>
            )}
          </Show>
        </div>
        <details>
          <summary class={disclosureSummaryClass}>Agent run summary</summary>
          <p class={disclosureBodyClass}>{props.context.runTrace.summary}</p>
        </details>
      </ReviewSection>

      <ReviewSection index={4} label="What already happened">
        <Show
          when={hasPriorWork()}
          fallback={<p class={reviewBodyClass}>no prior work on this pair</p>}
        >
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
            <div class={css({ display: "grid", gap: "2" })}>
              <p class={eyebrowClass}>Prior hypotheses</p>
              <UIList class={priorWorkListClass}>
                <For each={props.context.related.priorHypotheses}>
                  {(hypothesis) => (
                    <li class={priorHypothesisClass}>
                      <p class={reviewBodyClass}>{hypothesis.title}</p>
                      <span class={metaLabelClass}>
                        {hypothesis.status}
                        {hypothesis.resolution
                          ? ` · ${hypothesis.resolution}`
                          : ""}
                      </span>
                    </li>
                  )}
                </For>
              </UIList>
            </div>
            <div class={css({ display: "grid", gap: "2" })}>
              <p class={eyebrowClass}>Failure archive hits</p>
              <UIList class={priorWorkListClass}>
                <For each={props.context.related.failures}>
                  {(failure) => (
                    <li class={failureHitClass}>
                      <p class={reviewBodyClass}>{failure.title}</p>
                      <span class={metaLabelClass}>
                        {humanize(failure.reason)}
                      </span>
                    </li>
                  )}
                </For>
              </UIList>
            </div>
          </div>
        </Show>
      </ReviewSection>

      <ReviewSection index={5} label="Decide">
        {props.decide}
      </ReviewSection>
    </article>
  );
}

/** Link to the hypothesis/recipe a draft was promoted into, when approved. */
export function PromotedLink(props: {
  kind: AgentDraftKind;
  promotedId?: string;
}) {
  return (
    <Show when={props.promotedId}>
      {(promotedId) => (
        <Show
          when={props.kind === "hypothesis_draft"}
          fallback={
            <Link
              to="/recipes/$recipeId"
              params={{ recipeId: promotedId() }}
              class={inlineActionLink}
            >
              View Promoted Recipe <span aria-hidden="true">↗</span>
            </Link>
          }
        >
          <Link
            to="/hypotheses/$hypothesisId"
            params={{ hypothesisId: promotedId() }}
            class={inlineActionLink}
          >
            View Promoted Hypothesis <span aria-hidden="true">↗</span>
          </Link>
        </Show>
      )}
    </Show>
  );
}

/** Inline decision record (status + decidedBy + note + promotion link). */
export function DecisionState(props: { draft: PersistedReviewDraft }) {
  return (
    <Show when={props.draft.status !== "pending_review"}>
      <div
        class={css({
          borderColor: "zodiac.cream/12",
          borderRadius: "l2",
          borderWidth: "1px",
          display: "grid",
          gap: "2",
          p: "3",
        })}
      >
        <div class={badgeRowClass}>
          <UIBadge tone={statusTone(props.draft.status)}>
            {props.draft.status}
          </UIBadge>
          <Show when={props.draft.decidedBy}>
            {(decidedBy) => <UIBadge tone="cream">by {decidedBy()}</UIBadge>}
          </Show>
        </div>
        <Show when={props.draft.decisionNote}>
          {(note) => (
            <p class={helperClass}>
              <span class={fieldLabelClass}>Note</span> {note()}
            </p>
          )}
        </Show>
        <Show when={props.draft.decisionSource}>
          {(source) => <p class={helperClass}>Decision source: {source()}</p>}
        </Show>
        <Show when={props.draft.decisionTranscript}>
          {(transcript) => (
            <details>
              <summary>Decision transcript</summary>
              <p class={helperClass}>{transcript()}</p>
            </details>
          )}
        </Show>
        <Show when={props.draft.decisionIntentId}>
          {(intentId) => (
            <Link
              class={inlineActionLink}
              to="/agent-drafts"
              search={{ intent: intentId() }}
            >
              Review decision intent {intentId()}
            </Link>
          )}
        </Show>
        <PromotedLink
          kind={props.draft.kind}
          promotedId={
            props.draft.status === "approved"
              ? props.draft.promotedId
              : undefined
          }
        />
      </div>
    </Show>
  );
}
