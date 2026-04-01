import { createSignal, For, onMount, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
} from "../components/ui";
import {
  createAction,
  createMutation,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

const statGridClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "repeat(2, minmax(0, 1fr))",
    md: "repeat(4, minmax(0, 1fr))",
  },
});

function statusTone(status: string): "gold" | "violet" | "cream" {
  if (status === "text_ready") return "violet";
  if (status === "review_needed" || status === "extracted") return "cream";
  return "gold";
}

function confidenceTone(value: string): "gold" | "violet" | "cream" {
  if (value === "high") return "gold";
  if (value === "medium") return "violet";
  return "cream";
}

const DISPLAY_QUEUE_LIMIT = import.meta.env.VITE_E2E_MODE === "1" ? 200 : 24;

export function DisplayPage() {
  onMount(() => {
    document.title = "Display Queue — Frequency Music";
  });

  type InboxRow = {
    _id: Id<"sources">;
    status: string;
    type: string;
    title?: string;
    blockedReason?: string;
    canonicalUrl?: string;
    nextAction: string;
    extractionPreview?: {
      summary: string;
      claimPreviews: Array<{
        text: string;
        truthConfidence?: "low" | "medium" | "high";
        interestLevel?: "low" | "medium" | "high";
      }>;
    } | null;
  };

  const inboxRows = createQueryWithStatus(convexApi.inbox.list, () => ({
    limit: DISPLAY_QUEUE_LIMIT,
  }));
  const counts = createQuery(convexApi.inbox.counts);
  const editorialSignals = createQuery(
    convexApi.dashboard.editorialSignals,
    () => ({
      limit: 6,
    }),
  );

  const runExtraction = createAction(convexApi.extract.extractSource);
  const updateStatus = createMutation(convexApi.sources.updateStatus);
  const setVisibility = createMutation(convexApi.sources.setVisibility);

  const [notice, setNotice] = createSignal<string | null>(null);

  async function runRowExtraction(sourceId: Id<"sources">) {
    try {
      await runExtraction({ sourceId });
      setNotice("Extraction started.");
    } catch (error) {
      setNotice(`Extraction failed: ${String(error)}`);
    }
  }

  async function markTriaged(sourceId: Id<"sources">) {
    try {
      await updateStatus({
        id: sourceId,
        status: "triaged" as const,
      });
      setNotice("Source marked as triaged.");
    } catch (error) {
      setNotice(`Status update failed: ${String(error)}`);
    }
  }

  async function promoteFollowers(sourceId: Id<"sources">) {
    try {
      await setVisibility({
        id: sourceId,
        visibility: "followers",
      });
      setNotice("Visibility promoted to followers.");
    } catch (error) {
      setNotice(`Promotion failed: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Display & Triage</h1>
        <p
          class={css({ color: "rgba(245, 240, 232, 0.62)", lineHeight: "1.6" })}
        >
          This queue prioritizes blocked and oldest private sources so weekly
          review stays aligned with ingest throughput.
        </p>
        <div aria-live="polite">
          <Show when={notice()}>
            {(message) => (
              <p class={css({ color: "zodiac.cream", marginTop: "3" })}>
                {message()}
              </p>
            )}
          </Show>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Inbox Totals</h2>
        <div class={statGridClass}>
          <div>
            <div class={css({ color: "zodiac.gold", fontSize: "3xl" })}>
              {counts()?.ingested ?? 0}
            </div>
            <div
              class={css({
                color: "rgba(245, 240, 232, 0.58)",
                fontFamily: "mono",
                fontSize: "xs",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              })}
            >
              Ingested
            </div>
          </div>
          <div>
            <div class={css({ color: "zodiac.violet", fontSize: "3xl" })}>
              {counts()?.textReady ?? 0}
            </div>
            <div
              class={css({
                color: "rgba(245, 240, 232, 0.58)",
                fontFamily: "mono",
                fontSize: "xs",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              })}
            >
              Text Ready
            </div>
          </div>
          <div>
            <div class={css({ color: "zodiac.cream", fontSize: "3xl" })}>
              {counts()?.reviewNeeded ?? 0}
            </div>
            <div
              class={css({
                color: "rgba(245, 240, 232, 0.58)",
                fontFamily: "mono",
                fontSize: "xs",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              })}
            >
              Review Needed
            </div>
          </div>
          <div>
            <div class={css({ color: "zodiac.error", fontSize: "3xl" })}>
              {counts()?.blocked ?? 0}
            </div>
            <div
              class={css({
                color: "rgba(245, 240, 232, 0.58)",
                fontFamily: "mono",
                fontSize: "xs",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              })}
            >
              Blocked
            </div>
          </div>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Editorial Signals</h2>
        <p
          class={css({
            color: "rgba(245, 240, 232, 0.58)",
            lineHeight: "1.6",
            mb: "3",
          })}
        >
          These concept areas combine hypothesis outcomes, downstream recipes,
          compositions, and listening verdicts into a pragmatic yield score.
        </p>
        <div
          class={css({
            display: "grid",
            gap: "4",
            gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
          })}
        >
          <div>
            <div class={css({ color: "zodiac.gold", fontSize: "sm", mb: "2" })}>
              High-yield areas
            </div>
            <Show
              when={(editorialSignals()?.highYieldClusters ?? []).length > 0}
              fallback={
                <p class={css({ color: "rgba(245, 240, 232, 0.58)" })}>
                  No high-yield clusters yet.
                </p>
              }
            >
              <For each={editorialSignals()?.highYieldClusters ?? []}>
                {(cluster) => (
                  <div class={css({ mb: "2" })}>
                    <div class={css({ color: "zodiac.cream" })}>
                      {cluster.domain}
                    </div>
                    <div
                      class={css({
                        color: "rgba(245, 240, 232, 0.58)",
                        fontSize: "sm",
                      })}
                    >
                      {cluster.conceptNames.join(", ")} · score {cluster.score}
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
          <div>
            <div class={css({ color: "zodiac.gold", fontSize: "sm", mb: "2" })}>
              Low-yield areas
            </div>
            <Show
              when={(editorialSignals()?.lowYieldClusters ?? []).length > 0}
              fallback={
                <p class={css({ color: "rgba(245, 240, 232, 0.58)" })}>
                  No low-yield clusters yet.
                </p>
              }
            >
              <For each={editorialSignals()?.lowYieldClusters ?? []}>
                {(cluster) => (
                  <div class={css({ mb: "2" })}>
                    <div class={css({ color: "zodiac.cream" })}>
                      {cluster.domain}
                    </div>
                    <div
                      class={css({
                        color: "rgba(245, 240, 232, 0.58)",
                        fontSize: "sm",
                      })}
                    >
                      {cluster.conceptNames.join(", ")} · score {cluster.score}
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Action Queue</h2>

        <Show when={!inboxRows.isLoading()} fallback={<p>Loading inbox…</p>}>
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={inboxRows.data() ?? []}>
              {(row: InboxRow) => (
                <div
                  data-testid="display-row"
                  class={css({
                    borderColor: "rgba(200, 168, 75, 0.24)",
                    borderRadius: "l2",
                    borderWidth: "1px",
                    p: "4",
                  })}
                >
                  <div
                    class={css({
                      alignItems: "center",
                      display: "flex",
                      gap: "2",
                      marginBottom: "2",
                    })}
                  >
                    <UIBadge tone={statusTone(row.status)}>
                      {row.status}
                    </UIBadge>
                    <UIBadge tone="cream">{row.type}</UIBadge>
                    <Show when={row.blockedReason}>
                      <UIBadge tone="violet">
                        blocked: {row.blockedReason}
                      </UIBadge>
                    </Show>
                  </div>

                  <h3 class={css({ fontSize: "xl", marginBottom: "1" })}>
                    {row.title ?? "Untitled source"}
                  </h3>
                  <p
                    class={css({
                      color: "rgba(245, 240, 232, 0.66)",
                      fontSize: "sm",
                      marginBottom: "2",
                    })}
                  >
                    Next action: <strong>{row.nextAction}</strong>
                  </p>

                  <Show when={row.extractionPreview}>
                    {(preview) => (
                      <div class={css({ marginBottom: "2" })}>
                        <p
                          class={css({
                            color: "rgba(245, 240, 232, 0.56)",
                            fontSize: "sm",
                            marginBottom: "2",
                          })}
                        >
                          {preview().summary}
                        </p>
                        <Show when={preview().claimPreviews.length > 0}>
                          <div class={css({ display: "grid", gap: "2" })}>
                            <For each={preview().claimPreviews}>
                              {(claim) => (
                                <div
                                  class={css({
                                    bg: "rgba(245, 240, 232, 0.02)",
                                    borderColor: "rgba(200, 168, 75, 0.16)",
                                    borderRadius: "l2",
                                    borderWidth: "1px",
                                    p: "2.5",
                                  })}
                                >
                                  <p
                                    class={css({
                                      color: "rgba(245, 240, 232, 0.68)",
                                      fontSize: "sm",
                                      marginBottom: "2",
                                    })}
                                  >
                                    {claim.text}
                                  </p>
                                  <div
                                    class={css({
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "2",
                                    })}
                                  >
                                    <Show when={claim.truthConfidence}>
                                      {(value) => (
                                        <UIBadge tone={confidenceTone(value())}>
                                          truth: {value()}
                                        </UIBadge>
                                      )}
                                    </Show>
                                    <Show when={claim.interestLevel}>
                                      {(value) => (
                                        <UIBadge tone={confidenceTone(value())}>
                                          interest: {value()}
                                        </UIBadge>
                                      )}
                                    </Show>
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    )}
                  </Show>

                  <div
                    class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}
                  >
                    <UIButton
                      variant="outline"
                      disabled={row.status !== "text_ready"}
                      onClick={() => runRowExtraction(row._id)}
                    >
                      Run Extraction
                    </UIButton>
                    <UIButton
                      variant="outline"
                      onClick={() => markTriaged(row._id)}
                    >
                      Mark Triaged
                    </UIButton>
                    <UIButton
                      variant="ghost"
                      onClick={() => promoteFollowers(row._id)}
                    >
                      Promote Followers
                    </UIButton>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </UICard>
    </section>
  );
}
