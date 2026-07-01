import { Link } from "@tanstack/solid-router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  fieldLabelClass,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UICard,
  UISelect,
} from "../components/ui";
import { createQueryWithStatus } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

type AgentRunStatus = Doc<"agentRuns">["status"];
type AgentRunEventKind = Doc<"agentRunEvents">["kind"];

const STATUSES: Array<{ value: "" | AgentRunStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "needs_review", label: "Needs Review" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const GRAPHS = [
  { value: "", label: "All graphs" },
  { value: "research-pipeline", label: "Research Pipeline" },
  { value: "weekly-brief", label: "Weekly Brief" },
] as const;

const helperClass = css({
  color: "rgba(245, 240, 232, 0.58)",
  fontSize: "sm",
  lineHeight: "1.6",
});

const metricGridClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: { base: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))", xl: "repeat(6, minmax(0, 1fr))" },
});

const runRowClass = css({
  bg: "rgba(245, 240, 232, 0.025)",
  borderColor: "rgba(200, 168, 75, 0.18)",
  borderRadius: "l2",
  borderWidth: "1px",
  cursor: "pointer",
  display: "grid",
  gap: "3",
  p: "4",
  textAlign: "left",
  transition: "border-color 160ms ease, background 160ms ease",
  width: "100%",
  _hover: { bg: "rgba(200, 168, 75, 0.06)", borderColor: "rgba(200, 168, 75, 0.42)" },
});

const selectedRunRowClass = css({
  bg: "rgba(139, 92, 246, 0.08)",
  borderColor: "rgba(139, 92, 246, 0.58)",
});

const metaClass = css({
  color: "rgba(245, 240, 232, 0.6)",
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

function formatDuration(run: Doc<"agentRuns">) {
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

function isSmokeRun(run: { smokeMode?: boolean; input?: unknown }) {
  if (run.smokeMode === true) return true;
  const input = run.input;
  return Boolean(input && typeof input === "object" && "smokeMode" in input && input.smokeMode);
}

export function AgentRunsPage() {
  onMount(() => {
    document.title = "Agent Runs — Frequency Music";
  });

  const [status, setStatus] = createSignal<"" | AgentRunStatus>("");
  const [graphName, setGraphName] = createSignal("");
  const [selectedRunId, setSelectedRunId] = createSignal<Id<"agentRuns"> | null>(null);

  const runs = createQueryWithStatus(convexApi.agentRuns.listRecent, () => ({
    limit: 40,
    ...(status() ? { status: status() as AgentRunStatus } : {}),
    ...(graphName() ? { graphName: graphName() } : {}),
  }));
  const counts = createQueryWithStatus(convexApi.agentRuns.statusCounts, () => ({
    limit: 100,
    ...(graphName() ? { graphName: graphName() } : {}),
  }));
  const pendingDrafts = createQueryWithStatus(
    convexApi.agentDrafts.listPending,
    () => ({ limit: 100 }),
  );
  const pendingDraftCount = createMemo(
    () => (pendingDrafts.data() ?? []).length,
  );
  const events = createQueryWithStatus(convexApi.agentRuns.listEvents, () => {
    const runId = selectedRunId();
    return runId ? { runId, limit: 80 } : "skip";
  });

  const selectedRun = createMemo(() =>
    (runs.data() ?? []).find((run: Doc<"agentRuns">) => run._id === selectedRunId()),
  );
  const listError = createMemo(() => runs.error() ?? counts.error());

  function selectRun(run: Doc<"agentRuns">) {
    setSelectedRunId((current) => (current === run._id ? null : (run._id as Id<"agentRuns">)));
  }

  return (
    <section class={pageClass}>
      <UICard>
        <UIBadge tone="gold">LangGraph Control Plane</UIBadge>
        <h1 class={pageTitleClass}>Agent Runs</h1>
        <p class={css({ color: "rgba(245, 240, 232, 0.62)", lineHeight: "1.6" })}>
          Observe dry-runs and production agent lifecycle records written through the Convex audit
          surface. Details load only when a run is selected.
        </p>
        <Link
          to="/agent-drafts"
          class={css({
            alignItems: "center",
            display: "inline-flex",
            gap: "2",
            mt: "3",
            textDecoration: "none",
          })}
        >
          <UIBadge tone={pendingDraftCount() > 0 ? "violet" : "cream"}>
            {pendingDraftCount()} Pending Review
          </UIBadge>
          <span
            class={css({
              color: "zodiac.gold",
              fontFamily: "mono",
              fontSize: "xs",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            })}
          >
            Open Review Queue ↗
          </span>
        </Link>
      </UICard>

      <Show when={listError()}>
        {(error) => (
          <UICard>
            <UIBadge tone="violet">Convex Query Error</UIBadge>
            <h2 class={sectionTitleClass}>Agent run data is not available yet</h2>
            <p class={helperClass}>
              {error().message || "The agent-run queries failed before returning data."}
            </p>
            <p class={helperClass}>
              This usually means the browser is not fully authenticated with Convex, the app was built
              against the wrong Convex deployment, or the Clerk JWT template named "convex" is missing.
            </p>
          </UICard>
        )}
      </Show>

      <UICard>
        <h2 class={sectionTitleClass}>Recent Activity</h2>
        <div class={metricGridClass}>
          <For each={STATUSES.filter((item) => item.value)}>
            {(item) => (
              <div>
                <UIBadge tone={item.value === "failed" ? "violet" : "cream"}>{item.label}</UIBadge>
                <p class={css({ color: "zodiac.cream", fontFamily: "display", fontSize: "2xl", mt: "2" })}>
                  {counts.data()?.[item.value as AgentRunStatus] ?? 0}
                </p>
              </div>
            )}
          </For>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Filters</h2>
        <div class={css({ display: "grid", gap: "3", gridTemplateColumns: { base: "1fr", md: "1fr 1fr" } })}>
          <div>
            <label class={fieldLabelClass} for="agent-run-status">
              Status
            </label>
            <UISelect
              id="agent-run-status"
              value={status()}
              onChange={(event) => {
                setStatus(event.currentTarget.value as "" | AgentRunStatus);
                setSelectedRunId(null);
              }}
            >
              <For each={STATUSES}>{(item) => <option value={item.value}>{item.label}</option>}</For>
            </UISelect>
          </div>
          <div>
            <label class={fieldLabelClass} for="agent-run-graph">
              Graph
            </label>
            <UISelect
              id="agent-run-graph"
              value={graphName()}
              onChange={(event) => {
                setGraphName(event.currentTarget.value);
                setSelectedRunId(null);
              }}
            >
              <For each={GRAPHS}>{(item) => <option value={item.value}>{item.label}</option>}</For>
            </UISelect>
          </div>
        </div>
      </UICard>

      <div class={css({ display: "grid", gap: "4", gridTemplateColumns: { base: "1fr", xl: "minmax(0, 1.08fr) minmax(360px, 0.92fr)" } })}>
        <UICard>
          <h2 class={sectionTitleClass}>Runs</h2>
          <Show
            when={!runs.isLoading() && (runs.data() ?? []).length > 0}
            fallback={
              <p class={helperClass}>
                {runs.isLoading()
                  ? "Loading agent runs..."
                  : runs.error()
                    ? `Unable to load agent runs: ${runs.error()?.message}`
                    : "No agent runs match the current filters."}
              </p>
            }
          >
            <div class={css({ display: "grid", gap: "3" })}>
              <For each={runs.data() ?? []}>
                {(run: Doc<"agentRuns">) => (
                  <button
                    type="button"
                    data-testid="agent-run-row"
                    class={run._id === selectedRunId() ? `${runRowClass} ${selectedRunRowClass}` : runRowClass}
                    onClick={() => selectRun(run)}
                    aria-expanded={run._id === selectedRunId()}
                  >
                    <div class={css({ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "2", justifyContent: "space-between" })}>
                      <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
                        <UIBadge tone={statusTone(run.status)}>{run.status}</UIBadge>
                        <UIBadge tone="violet">{run.graphName}</UIBadge>
                        <Show when={isSmokeRun(run)}>
                          <UIBadge tone="cream">Smoke</UIBadge>
                        </Show>
                      </div>
                      <span class={metaClass}>{formatDuration(run)}</span>
                    </div>
                    <p class={css({ color: "zodiac.cream", fontFamily: "display", fontSize: "lg", lineHeight: "1.35" })}>
                      {run.summary ?? "No summary yet"}
                    </p>
                    <div class={css({ display: "flex", flexWrap: "wrap", gap: "3", alignItems: "center" })}>
                      <span class={metaClass}>Updated {formatTime(run.updatedAt)}</span>
                      <span class={metaClass}>Run {String(run._id).slice(0, 12)}</span>
                      <Link
                        to="/agent-runs/$runId"
                        params={{ runId: String(run._id) }}
                        class={css({ color: "zodiac.gold", fontFamily: "mono", fontSize: "xs", letterSpacing: "0.08em", textTransform: "uppercase" })}
                        onClick={(event) => event.stopPropagation()}
                      >
                        Open Detail ↗
                      </Link>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </UICard>

        <UICard>
          <h2 class={sectionTitleClass}>Details On Demand</h2>
          <Show
            when={selectedRun()}
            fallback={<p class={helperClass}>Select a run to inspect its lifecycle timeline and payloads.</p>}
          >
            {(run) => (
              <div class={css({ display: "grid", gap: "4" })}>
                <div>
                  <div class={css({ display: "flex", flexWrap: "wrap", gap: "2", mb: "3" })}>
                    <UIBadge tone={statusTone(run().status)}>{run().status}</UIBadge>
                    <UIBadge tone="violet">{run().graphName}</UIBadge>
                    <Show when={run().traceUrl}>
                      {(traceUrl) => (
                        <a class={css({ color: "zodiac.gold", fontFamily: "mono", fontSize: "xs" })} href={traceUrl()} target="_blank" rel="noreferrer">
                          Trace ↗
                        </a>
                      )}
                    </Show>
                  </div>
                  <p class={helperClass}>{run().summary ?? "This run has not recorded a summary yet."}</p>
                  <dl class={css({ display: "grid", gap: "2", gridTemplateColumns: "auto 1fr", mt: "3" })}>
                    <dt class={metaClass}>Created</dt>
                    <dd class={helperClass}>{formatTime(run().createdAt)}</dd>
                    <dt class={metaClass}>Started</dt>
                    <dd class={helperClass}>{formatTime(run().startedAt)}</dd>
                    <dt class={metaClass}>Finished</dt>
                    <dd class={helperClass}>{formatTime(run().finishedAt)}</dd>
                    <dt class={metaClass}>Duration</dt>
                    <dd class={helperClass}>{formatDuration(run())}</dd>
                  </dl>
                </div>

                <div>
                  <h3 class={css({ color: "zodiac.gold", fontFamily: "mono", fontSize: "sm", letterSpacing: "0.18em", mb: "3", textTransform: "uppercase" })}>
                    Event Timeline
                  </h3>
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
                            <article class={eventClass} data-testid="agent-run-event">
                              <div class={css({ display: "flex", flexWrap: "wrap", gap: "2", justifyContent: "space-between" })}>
                                <UIBadge tone={eventTone(event.kind)}>{event.kind}</UIBadge>
                                <span class={metaClass}>{formatTime(event.createdAt)}</span>
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
                </div>
              </div>
            )}
          </Show>
        </UICard>
      </div>
    </section>
  );
}
