import { Link } from "@tanstack/solid-router";
import { For, type JSX, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
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
