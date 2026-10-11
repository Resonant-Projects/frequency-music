import { Link } from "@tanstack/solid-router";
import type { FunctionReturnType } from "convex/server";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import {
  AgentRunEventList,
  AgentRunTime,
  AgentRunTimesList,
} from "../components/agent-run-event";
import {
  fieldLabelClass,
  focusRingClass,
  helperClass,
  inlineActionLink,
  metaLine,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UICard,
  UINotice,
  UISelect,
} from "../components/ui";
import { createQueryWithStatus } from "../integrations/convex";
import {
  type AgentRunStatus,
  formatDuration,
  runStatusTone,
} from "../lib/agent-run-format";
import { api } from "../../../convex/_generated/api";

type AgentRun = FunctionReturnType<
  typeof api.agentRuns.listRecentPublic
>[number];

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

const metricGridClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "repeat(2, minmax(0, 1fr))",
    md: "repeat(3, minmax(0, 1fr))",
    xl: "repeat(6, minmax(0, 1fr))",
  },
});

const runListClass = css({
  display: "grid",
  gap: "3",
  listStyleType: "none",
  m: "0",
  p: "0",
});

const runRowClass = css({
  bg: "zodiac.cream/2.5",
  borderColor: "zodiac.gold/18",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "grid",
  gap: "3",
  minW: "0",
  p: "4",
  textAlign: "left",
  transition: "border-color 160ms ease, background 160ms ease",
  width: "100%",
  _hover: {
    bg: "zodiac.gold/6",
    borderColor: "zodiac.gold/42",
  },
});

/**
 * The select/expand control inside a run row. It is a sibling of the row's
 * detail Link — a link must never be a descendant of a button.
 */
const runRowTriggerClass = css({
  bg: "transparent",
  color: "inherit",
  cursor: "pointer",
  display: "grid",
  gap: "3",
  minW: "0",
  p: "0",
  textAlign: "left",
  width: "100%",
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "zodiac.gold",
    outlineOffset: "2px",
  },
});

const selectedRunRowClass = css({
  bg: "zodiac.violet/8",
  borderColor: "zodiac.violet/58",
});

/** The details card that each run row's `aria-controls` points at. */
const DETAILS_CARD_ID = "agent-run-details";
const DETAILS_TITLE_ID = "agent-run-details-title";

/** Panda's `xl` breakpoint, where the details card sits beside the list. */
const SIDE_BY_SIDE_QUERY = "(min-width: 80em)";

function isSmokeRun(run: { smokeMode?: boolean; input?: unknown }) {
  if (run.smokeMode === true) return true;
  const input = run.input;
  return Boolean(
    input &&
      typeof input === "object" &&
      "smokeMode" in input &&
      input.smokeMode,
  );
}

export function AgentRunsPage() {
  onMount(() => {
    document.title = "Agent Runs — Frequency Music";
  });

  const [status, setStatus] = createSignal<"" | AgentRunStatus>("");
  const [graphName, setGraphName] = createSignal("");
  const [selectedRunId, setSelectedRunId] =
    createSignal<Id<"agentRuns"> | null>(null);
  let detailsCard: HTMLElement | undefined;
  let detailsTitle: HTMLHeadingElement | undefined;

  const runs = createQueryWithStatus(api.agentRuns.listRecentPublic, () => ({
    limit: 40,
    ...(status() ? { status: status() as AgentRunStatus } : {}),
    ...(graphName() ? { graphName: graphName() } : {}),
  }));
  const counts = createQueryWithStatus(
    api.agentRuns.statusCountsPublic,
    () => ({
      limit: 100,
      ...(graphName() ? { graphName: graphName() } : {}),
    }),
  );
  const pendingDraftCount = createQueryWithStatus(
    api.agentDrafts.countPendingPublic,
  );
  const events = createQueryWithStatus(api.agentRuns.listEventsPublic, () => {
    const runId = selectedRunId();
    return runId ? { runId, limit: 80 } : "skip";
  });

  const selectedRun = createMemo(() =>
    (runs.data() ?? []).find((run: AgentRun) => run._id === selectedRunId()),
  );
  const listError = createMemo(() => runs.error() ?? counts.error());
  // The Runs card already announces `runs.error()` with more specific copy;
  // repeating it here fired two role="alert" regions for one failure.
  const listErrorMessage = () => {
    if (runs.error()) return null;
    const error = counts.error();
    return error
      ? error.message || "The agent-run queries failed before returning data."
      : null;
  };
  const runsStatus = () => {
    if (runs.isLoading()) return "Loading agent runs...";
    if (runs.error() || (runs.data() ?? []).length > 0) return null;
    return "No agent runs match the current filters.";
  };
  const runsError = () =>
    runs.error() ? `Unable to load agent runs: ${runs.error()?.message}` : null;
  const eventsStatus = () => {
    if (events.isLoading()) return "Loading events...";
    if (events.error() || (events.data() ?? []).length > 0) return null;
    return "No events recorded for this run.";
  };
  const eventsError = () =>
    events.error() ? `Unable to load events: ${events.error()?.message}` : null;

  function selectRun(run: AgentRun) {
    const opening = selectedRunId() !== run._id;
    setSelectedRunId(opening ? (run._id as Id<"agentRuns">) : null);
    // Below `xl` the details card stacks under the whole list, so opening a
    // run would otherwise change content far off-screen. Bring it to the
    // reader and hand focus to its heading.
    if (!opening || window.matchMedia(SIDE_BY_SIDE_QUERY).matches) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    detailsTitle?.focus({ preventScroll: true });
    detailsCard?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <section class={pageClass}>
      <UICard>
        <UIBadge tone="gold">LangGraph Control Plane</UIBadge>
        <h1 class={pageTitleClass}>Agent Runs</h1>
        <p class={helperClass}>
          Observe dry-runs and production agent lifecycle records written
          through the Convex audit surface. Details load only when a run is
          selected.
        </p>
        <Link
          to="/agent-drafts"
          class={cx(inlineActionLink, css({ gap: "2", mt: "3" }))}
        >
          <UIBadge
            tone={(pendingDraftCount.data() ?? 0) > 0 ? "violet" : "cream"}
          >
            {pendingDraftCount.data() ?? 0} Pending Review
          </UIBadge>
          <span>
            Open Review Queue <span aria-hidden="true">↗</span>
          </span>
        </Link>

        <Show when={listError()}>
          <div
            class={css({
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "2",
              mt: "5",
            })}
          >
            <UIBadge tone="violet">Convex Query Error</UIBadge>
            <h2 class={cx(sectionTitleClass, css({ mb: "0" }))}>
              Agent run data is not available yet
            </h2>
          </div>
        </Show>
        <UINotice class={css({ mt: "3" })} error={listErrorMessage()} />
        <Show when={listError()}>
          <p class={helperClass}>
            This usually means the browser is not fully authenticated with
            Convex, the app was built against the wrong Convex deployment, or
            the Clerk JWT template named "convex" is missing.
          </p>
        </Show>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Recent Activity</h2>
        <div class={metricGridClass}>
          <For each={STATUSES.filter((item) => item.value)}>
            {(item) => (
              <div>
                <UIBadge tone={item.value === "failed" ? "violet" : "cream"}>
                  {item.label}
                </UIBadge>
                <p
                  class={css({
                    color: "zodiac.cream",
                    fontFamily: "display",
                    fontSize: "2xl",
                    mt: "2",
                  })}
                >
                  {counts.isLoading()
                    ? "—"
                    : (counts.data()?.[item.value as AgentRunStatus] ?? 0)}
                </p>
              </div>
            )}
          </For>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Filters</h2>
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
              <For each={STATUSES}>
                {(item) => <option value={item.value}>{item.label}</option>}
              </For>
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
              <For each={GRAPHS}>
                {(item) => <option value={item.value}>{item.label}</option>}
              </For>
            </UISelect>
          </div>
        </div>
      </UICard>

      <div
        class={css({
          display: "grid",
          gap: "4",
          gridTemplateColumns: {
            base: "minmax(0, 1fr)",
            xl: "minmax(0, 1.08fr) minmax(360px, 0.92fr)",
          },
        })}
      >
        <UICard>
          <h2 class={sectionTitleClass}>Runs</h2>
          <UINotice status={runsStatus()} error={runsError()} />
          <Show when={!runs.isLoading() && (runs.data() ?? []).length > 0}>
            <ul role="list" class={runListClass}>
              <For each={runs.data() ?? []}>
                {(run: AgentRun) => (
                  <li
                    class={
                      run._id === selectedRunId()
                        ? cx(runRowClass, selectedRunRowClass)
                        : runRowClass
                    }
                  >
                    <button
                      type="button"
                      data-testid="agent-run-row"
                      class={runRowTriggerClass}
                      onClick={() => selectRun(run)}
                      aria-expanded={run._id === selectedRunId()}
                      aria-controls={DETAILS_CARD_ID}
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
                        <div
                          class={css({
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "2",
                          })}
                        >
                          <UIBadge tone={runStatusTone(run.status)}>
                            {run.status}
                          </UIBadge>
                          <UIBadge tone="cream">{run.graphName}</UIBadge>
                          <Show when={isSmokeRun(run)}>
                            <UIBadge tone="cream">Smoke</UIBadge>
                          </Show>
                        </div>
                        <span class={metaLine}>{formatDuration(run)}</span>
                      </div>
                      <p
                        class={css({
                          color: "zodiac.cream",
                          fontFamily: "display",
                          fontSize: "lg",
                          lineHeight: "1.35",
                          overflowWrap: "anywhere",
                        })}
                      >
                        {run.summary ?? "No summary yet"}
                      </p>
                    </button>
                    <div
                      class={css({
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "3",
                        alignItems: "center",
                      })}
                    >
                      <span class={metaLine}>
                        Updated <AgentRunTime value={run.updatedAt} />
                      </span>
                      <span class={metaLine}>
                        Run {String(run._id).slice(0, 12)}
                      </span>
                      <Link
                        to="/agent-runs/$runId"
                        params={{ runId: String(run._id) }}
                        class={inlineActionLink}
                      >
                        Open Detail <span aria-hidden="true">↗</span>
                      </Link>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </UICard>

        <UICard
          id={DETAILS_CARD_ID}
          ref={(element: HTMLElement) => {
            detailsCard = element;
          }}
          aria-labelledby={DETAILS_TITLE_ID}
          class={css({
            minW: "0",
            scrollMarginTop: "calc(var(--app-header-height) + 1rem)",
          })}
        >
          <h2
            id={DETAILS_TITLE_ID}
            ref={(element) => {
              detailsTitle = element;
            }}
            tabIndex={-1}
            class={cx(sectionTitleClass, focusRingClass)}
          >
            Details On Demand
          </h2>
          <Show
            when={selectedRun()}
            fallback={
              <p class={helperClass}>
                Select a run to inspect its lifecycle timeline and payloads.
              </p>
            }
          >
            {(run) => (
              <div class={css({ display: "grid", gap: "4" })}>
                <div>
                  <div
                    class={css({
                      alignItems: "center",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "2",
                      mb: "3",
                    })}
                  >
                    <UIBadge tone={runStatusTone(run().status)}>
                      {run().status}
                    </UIBadge>
                    <UIBadge tone="cream">{run().graphName}</UIBadge>
                    <Show when={run().traceUrl}>
                      {(traceUrl) => (
                        <a
                          class={inlineActionLink}
                          href={traceUrl()}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Trace <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </Show>
                  </div>
                  <p class={helperClass}>
                    {run().summary ??
                      "This run has not recorded a summary yet."}
                  </p>
                  <AgentRunTimesList run={run()} class={css({ mt: "3" })} />
                </div>

                <div>
                  <h3 class={sectionTitleClass}>Event Timeline</h3>
                  <UINotice status={eventsStatus()} error={eventsError()} />
                  <Show
                    when={
                      !events.isLoading() && (events.data() ?? []).length > 0
                    }
                  >
                    <AgentRunEventList
                      events={(events.data() ?? []) as Doc<"agentRunEvents">[]}
                      itemTestId="agent-run-event"
                    />
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
