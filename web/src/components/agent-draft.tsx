import { Link } from "@tanstack/solid-router";
import type { FunctionReturnType } from "convex/server";
import { For, type JSX, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import { fieldLabelClass } from "./ui";
import { UIBadge } from "./ui";

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

export type HypothesisDraftPayload = {
  title: string;
  question: string;
  statement: string;
  rationale: string;
  whyThisMatters: string;
  concepts?: string[];
  sourceIds: string[];
  extractionIds: string[];
  correspondenceId?: string;
  thesisId?: string;
  confidence?: number;
};

export type RecipeDraftParameter = {
  kind?: string;
  type?: string;
  value: string;
  details?: unknown;
  canonicalKind?: string;
};

export type RecipeDraftPayload = {
  hypothesisId?: string;
  title: string;
  parameters: RecipeDraftParameter[];
  whyThisMatters: string;
  bodyMd?: string;
  dawChecklist?: string[];
  instrumentationNotes?: string;
  protocol?: {
    studyType?: string;
    durationSecs?: number;
    panelPlanned?: string[];
    whatVaries?: string[];
    whatStaysConstant?: string[];
    listeningContext?: string;
    listeningMethod?: string;
  };
};

export type AgentDraftPayload = HypothesisDraftPayload | RecipeDraftPayload;
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
  decidedAt?: number;
  decidedBy?: "human";
  decisionNote?: string;
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

const helperClass = css({
  color: "rgba(245, 240, 232, 0.62)",
  lineHeight: "1.6",
});

const monoValueClass = css({
  color: "rgba(245, 240, 232, 0.72)",
  fontFamily: "mono",
  fontSize: "xs",
  lineHeight: "1.5",
});

const bodyValueClass = css({
  color: "zodiac.cream",
  lineHeight: "1.6",
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
          <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
            <For each={props.payload.concepts ?? []}>
              {(concept) => <UIBadge tone="cream">{concept}</UIBadge>}
            </For>
          </div>
        </PayloadField>
      </Show>
      <Show when={props.payload.sourceIds.length > 0}>
        <PayloadField label="Source IDs">
          <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
            <For each={props.payload.sourceIds}>
              {(id) => <UIBadge tone="cream">{id}</UIBadge>}
            </For>
          </div>
        </PayloadField>
      </Show>
      <Show when={props.payload.extractionIds.length > 0}>
        <PayloadField label="Extraction IDs">
          <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
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
              class={css({
                color: "rgba(245, 240, 232, 0.72)",
                fontFamily: "mono",
                fontSize: "xs",
                lineHeight: "1.5",
                whiteSpace: "pre-wrap",
              })}
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
  borderTopColor: "rgba(245, 240, 232, 0.12)",
  borderTopWidth: "1px",
  display: "grid",
  gap: "3",
  pt: "5",
});

const reviewEyebrowClass = css({
  color: "rgba(245, 240, 232, 0.58)",
  fontFamily: "mono",
  fontSize: "2xs",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
});

const reviewHeadingClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "xl", md: "2xl" },
  fontWeight: "normal",
  lineHeight: "1.2",
});

const reviewBodyClass = css({
  color: "rgba(245, 240, 232, 0.82)",
  fontFamily: "display",
  fontSize: "lg",
  lineHeight: "1.65",
  maxW: "72ch",
});

function ReviewSection(props: {
  index: number;
  label: string;
  children: JSX.Element;
}) {
  return (
    <section class={reviewSectionClass}>
      <p class={reviewEyebrowClass}>
        {String(props.index).padStart(2, "0")} · {props.label}
      </p>
      {props.children}
    </section>
  );
}

function ConceptPanel(props: {
  concept: NonNullable<DraftReviewContext["correspondence"]>["conceptA"];
}) {
  return (
    <div
      class={css({
        bg: "rgba(26, 15, 53, 0.34)",
        borderColor: "rgba(139, 92, 246, 0.2)",
        borderRadius: "l2",
        borderWidth: "1px",
        display: "grid",
        gap: "2",
        p: "3",
      })}
    >
      <h3 class={reviewHeadingClass}>{props.concept.displayName}</h3>
      <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
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

/** The plan-07 five-section reading order for a single review decision. */
export function DraftReviewStory(props: {
  context: DraftReviewContext;
  payload?: AgentDraftPayload;
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
                <h2 class={reviewHeadingClass}>
                  {correspondence().row.statement}
                </h2>
                <UIBadge tone="cream">{correspondence().row.status}</UIBadge>
              </div>
              <Show
                when={
                  correspondence().row.similarityScore !== undefined ||
                  correspondence().row.noveltyScore !== undefined
                }
              >
                <p class={reviewEyebrowClass}>
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
                  gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
                })}
              >
                <ConceptPanel concept={correspondence().conceptA} />
                <ConceptPanel concept={correspondence().conceptB} />
              </div>
              <details>
                <summary
                  class={css({
                    color: "rgba(245, 240, 232, 0.72)",
                    cursor: "pointer",
                    fontFamily: "mono",
                    fontSize: "xs",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  })}
                >
                  Correspondence rationale
                </summary>
                <p class={cx(reviewBodyClass, css({ mt: "3" }))}>
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
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={props.context.correspondence?.evidence ?? []}>
              {(evidence) => {
                const contradicts = evidence.stance === "contradicts";
                return (
                  <div
                    class={css({
                      bg: contradicts
                        ? "rgba(139, 92, 246, 0.14)"
                        : "rgba(245, 240, 232, 0.035)",
                      borderColor: contradicts
                        ? "rgba(139, 92, 246, 0.56)"
                        : "rgba(245, 240, 232, 0.12)",
                      borderLeftWidth: "3px",
                      borderRadius: "l2",
                      display: "grid",
                      gap: "2",
                      p: "3",
                    })}
                  >
                    <div
                      class={css({
                        alignItems: "center",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "2",
                      })}
                    >
                      <span aria-hidden="true">{contradicts ? "⊘" : "✓"}</span>
                      <UIBadge tone={contradicts ? "violet" : "cream"}>
                        {evidence.stance}
                      </UIBadge>
                      <span class={reviewEyebrowClass}>
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
                        <span class={reviewEyebrowClass}>
                          {evidence.sourceTitle}
                        </span>
                      }
                    >
                      {(sourceUrl) => (
                        <a
                          class={css({
                            color: "zodiac.violet",
                            fontFamily: "mono",
                            fontSize: "xs",
                          })}
                          href={sourceUrl()}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {evidence.sourceTitle} ↗
                        </a>
                      )}
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </ReviewSection>

      <ReviewSection index={3} label="The proposed hypothesis">
        <Show when={hypothesisPayload()}>
          {(proposal) => (
            <div class={css({ display: "grid", gap: "4" })}>
              <div>
                <p class={reviewEyebrowClass}>Title</p>
                <h2 class={reviewHeadingClass}>{proposal().title}</h2>
              </div>
              <div>
                <p class={reviewEyebrowClass}>Question</p>
                <p class={reviewBodyClass}>{proposal().question}</p>
              </div>
              <div>
                <p class={reviewEyebrowClass}>Statement</p>
                <p class={reviewBodyClass}>{proposal().statement}</p>
              </div>
              <div>
                <p class={reviewEyebrowClass}>Why this matters</p>
                <p class={reviewBodyClass}>{proposal().whyThisMatters}</p>
              </div>
              <details>
                <summary
                  class={css({
                    color: "rgba(245, 240, 232, 0.72)",
                    cursor: "pointer",
                    fontFamily: "mono",
                    fontSize: "xs",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  })}
                >
                  Draft rationale
                </summary>
                <p class={cx(reviewBodyClass, css({ mt: "3" }))}>
                  {proposal().rationale}
                </p>
              </details>
            </div>
          )}
        </Show>
        <Show when={recipePayload()}>
          {(proposal) => (
            <div class={css({ display: "grid", gap: "4" })}>
              <div>
                <p class={reviewEyebrowClass}>Recipe title</p>
                <h2 class={reviewHeadingClass}>{proposal().title}</h2>
              </div>
              <div>
                <p class={reviewEyebrowClass}>Why this matters</p>
                <p class={reviewBodyClass}>{proposal().whyThisMatters}</p>
              </div>
              <DraftPayloadPreview kind="recipe_draft" payload={proposal()} />
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
            class={css({
              color: "zodiac.violet",
              fontFamily: "mono",
              fontSize: "xs",
            })}
          >
            Open run ↗
          </Link>
          <Show when={props.context.runTrace.traceUrl}>
            {(traceUrl) => (
              <a
                class={css({
                  color: "zodiac.violet",
                  fontFamily: "mono",
                  fontSize: "xs",
                })}
                href={traceUrl()}
                target="_blank"
                rel="noreferrer"
              >
                Open trace ↗
              </a>
            )}
          </Show>
        </div>
        <details>
          <summary
            class={css({
              color: "rgba(245, 240, 232, 0.72)",
              cursor: "pointer",
              fontFamily: "mono",
              fontSize: "xs",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            })}
          >
            Agent run summary
          </summary>
          <p class={cx(reviewBodyClass, css({ mt: "3" }))}>
            {props.context.runTrace.summary}
          </p>
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
              gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
            })}
          >
            <div class={css({ display: "grid", gap: "2" })}>
              <p class={reviewEyebrowClass}>Prior hypotheses</p>
              <For each={props.context.related.priorHypotheses}>
                {(hypothesis) => (
                  <div
                    class={css({
                      borderColor: "rgba(245, 240, 232, 0.12)",
                      borderRadius: "l2",
                      borderWidth: "1px",
                      display: "grid",
                      gap: "2",
                      p: "3",
                    })}
                  >
                    <p class={reviewBodyClass}>{hypothesis.title}</p>
                    <span class={reviewEyebrowClass}>
                      {hypothesis.status}
                      {hypothesis.resolution
                        ? ` · ${hypothesis.resolution}`
                        : ""}
                    </span>
                  </div>
                )}
              </For>
            </div>
            <div class={css({ display: "grid", gap: "2" })}>
              <p class={reviewEyebrowClass}>Failure archive hits</p>
              <For each={props.context.related.failures}>
                {(failure) => (
                  <div
                    class={css({
                      bg: "rgba(139, 92, 246, 0.1)",
                      borderColor: "rgba(139, 92, 246, 0.32)",
                      borderRadius: "l2",
                      borderWidth: "1px",
                      display: "grid",
                      gap: "2",
                      p: "3",
                    })}
                  >
                    <p class={reviewBodyClass}>{failure.title}</p>
                    <span class={reviewEyebrowClass}>
                      {humanize(failure.reason)}
                    </span>
                  </div>
                )}
              </For>
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
              class={css({
                color: "zodiac.gold",
                fontFamily: "mono",
                fontSize: "sm",
              })}
            >
              View Promoted Recipe ↗
            </Link>
          }
        >
          <Link
            to="/hypotheses/$hypothesisId"
            params={{ hypothesisId: promotedId() }}
            class={css({
              color: "zodiac.gold",
              fontFamily: "mono",
              fontSize: "sm",
            })}
          >
            View Promoted Hypothesis ↗
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
          borderColor: "rgba(245, 240, 232, 0.12)",
          borderRadius: "l2",
          borderWidth: "1px",
          display: "grid",
          gap: "2",
          p: "3",
        })}
      >
        <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
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
