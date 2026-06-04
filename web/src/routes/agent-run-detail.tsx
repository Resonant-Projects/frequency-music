import { Link, useParams } from "@tanstack/solid-router";
import { createMemo, For, onMount, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  backLink,
  detailTitleClass,
  fieldLabelClass,
  pageClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
} from "../components/ui";
import { createQueryWithStatus } from "../integrations/convex";
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

function formatDuration(run: Pick<PublicAgentRun, "createdAt" | "startedAt" | "finishedAt" | "updatedAt">) {
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

function draftLabel(kind: PublicReviewDraft["kind"]) {
  if (kind === "hypothesis_draft") return "Hypothesis Draft";
  if (kind === "recipe_draft") return "Recipe Draft";
  return "Dry-Run Summary";
}

export function AgentRunDetailPage() {
  const params = useParams({ from: "/agent-runs/$runId" });
  const runId = createMemo(() => params().runId as Id<"agentRuns">);

  const run = createQueryWithStatus(convexApi.agentRuns.getPublic, () => ({ runId: runId() }));
  const events = createQueryWithStatus(convexApi.agentRuns.listEvents, () => ({
    runId: runId(),
    limit: 120,
  }));

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
              {(error) => <p class={helperClass}>Unable to load agent run: {error().message}</p>}
            </Show>
          </UICard>
        }
      >
        {(row) => (
          <>
            <UICard>
              <div class={css({ display: "flex", flexWrap: "wrap", gap: "2", mb: "3" })}>
                <UIBadge tone={statusTone(row().status)}>{row().status}</UIBadge>
                <UIBadge tone="violet">{row().graphName}</UIBadge>
                <Show when={row().smokeMode}>
                  <UIBadge tone="cream">Smoke</UIBadge>
                </Show>
              </div>
              <h1 class={detailTitleClass}>Agent Run {String(row()._id).slice(0, 12)}</h1>
              <p class={helperClass}>{row().summary ?? "This run has not recorded a summary yet."}</p>
              <dl class={css({ display: "grid", gap: "2", gridTemplateColumns: "auto 1fr", mt: "4" })}>
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
                  <a class={css({ color: "zodiac.gold", display: "inline-block", fontFamily: "mono", fontSize: "sm", mt: "4" })} href={traceUrl()} target="_blank" rel="noreferrer">
                    Open LangSmith Trace ↗
                  </a>
                )}
              </Show>
            </UICard>

            <UICard>
              <h2 class={sectionTitleClass}>Review Draft</h2>
              <Show
                when={row().reviewDraft}
                fallback={<p class={helperClass}>No sanitized review draft has been attached to this run yet.</p>}
              >
                {(draft) => (
                  <div class={css({ display: "grid", gap: "4" })}>
                    <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
                      <UIBadge tone="gold">{draftLabel(draft().kind)}</UIBadge>
                      <UIBadge tone={draft().needsReview ? "violet" : "cream"}>
                        {draft().needsReview ? "Needs Review" : "Read Only"}
                      </UIBadge>
                    </div>
                    <h3 class={css({ color: "zodiac.cream", fontFamily: "display", fontSize: "2xl", lineHeight: "1.2" })}>
                      {draft().title}
                    </h3>
                    <p class={helperClass}>{draft().summary}</p>
                    <div>
                      <div class={fieldLabelClass}>Candidate IDs</div>
                      <div class={css({ display: "flex", flexWrap: "wrap", gap: "2", mt: "2" })}>
                        <For each={draft().candidateIds}>
                          {(candidateId) => <UIBadge tone="cream">{candidateId}</UIBadge>}
                        </For>
                      </div>
                    </div>
                    <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
                      <UIButton disabled>Approve</UIButton>
                      <UIButton disabled variant="outline">Reject</UIButton>
                      <UIButton disabled variant="ghost">Rerun with Notes</UIButton>
                    </div>
                    <p class={helperClass}>
                      Review actions are placeholders for the next promotion gate. They intentionally do not mutate research data yet.
                    </p>
                  </div>
                )}
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
                          <div class={css({ display: "flex", flexWrap: "wrap", gap: "2", justifyContent: "space-between" })}>
                            <UIBadge tone={eventTone(event.kind)}>{event.kind}</UIBadge>
                            <span class={monoClass}>{formatTime(event.createdAt)}</span>
                          </div>
                          <p class={css({ color: "zodiac.cream", lineHeight: "1.55" })}>{event.message}</p>
                          <Show when={payload()}>
                            {(text) => (
                              <pre class={css({ bg: "rgba(0, 0, 0, 0.22)", borderColor: "rgba(245, 240, 232, 0.12)", borderRadius: "l2", borderWidth: "1px", color: "rgba(245, 240, 232, 0.72)", fontFamily: "mono", fontSize: "xs", maxH: "18rem", overflow: "auto", p: "3", whiteSpace: "pre-wrap" })}>
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
