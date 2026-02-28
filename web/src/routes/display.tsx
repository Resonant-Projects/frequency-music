import { For, Show, createSignal } from "solid-js";
import { css } from "../../styled-system/css";
import { UIBadge, UIButton, UICard } from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import { convexApi } from "../integrations/convex/api";
import {
  createAction,
  createMutation,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";

const pageClass = css({
  display: "grid",
  gap: "6",
  p: { base: "4", md: "6" },
});

const statGridClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: { base: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
});

const sectionTitleClass = css({
  color: "zodiac.gold",
  fontSize: "lg",
  letterSpacing: "0.12em",
  marginBottom: "3",
  textTransform: "uppercase",
});

function statusTone(status: string): "gold" | "violet" | "cream" {
  if (status === "text_ready") return "violet";
  if (status === "review_needed" || status === "extracted") return "cream";
  return "gold";
}

const DISPLAY_QUEUE_LIMIT = import.meta.env.VITE_E2E_MODE === "1" ? 200 : 24;

export function DisplayPage() {
  const inboxRows = createQueryWithStatus(convexApi.inbox.list, () => ({
    limit: DISPLAY_QUEUE_LIMIT,
  }));
  const counts = createQuery(convexApi.inbox.counts);

  const runExtraction = createAction(convexApi.extract.extractSource);
  const updateStatus = createMutation(convexApi.sources.updateStatus);
  const setVisibility = createMutation(convexApi.sources.setVisibility);

  const [notice, setNotice] = createSignal<string | null>(null);

  async function runRowExtraction(sourceId: string) {
    try {
      await runExtraction(withDevBypassSecret({ sourceId: sourceId as any }));
      setNotice("Extraction started.");
    } catch (error) {
      setNotice(`Extraction failed: ${String(error)}`);
    }
  }

  async function markTriaged(sourceId: string) {
    try {
      await updateStatus(
        withDevBypassSecret({ id: sourceId as any, status: "triaged" }),
      );
      setNotice("Source marked as triaged.");
    } catch (error) {
      setNotice(`Status update failed: ${String(error)}`);
    }
  }

  async function promoteFollowers(sourceId: string) {
    try {
      await setVisibility(
        withDevBypassSecret({ id: sourceId as any, visibility: "followers" }),
      );
      setNotice("Visibility promoted to followers.");
    } catch (error) {
      setNotice(`Promotion failed: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={sectionTitleClass}>Display & Triage</h1>
        <p class={css({ color: "rgba(245, 240, 232, 0.62)", lineHeight: "1.6" })}>
          This queue prioritizes blocked and oldest private sources so weekly
          review stays aligned with ingest throughput.
        </p>
        <Show when={notice()}>
          {(message) => (
            <p class={css({ color: "zodiac.cream", marginTop: "3" })}>{message()}</p>
          )}
        </Show>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Inbox Totals</h2>
        <div class={statGridClass}>
          <div>
            <div class={css({ color: "zodiac.gold", fontSize: "3xl" })}>{counts()?.ingested ?? 0}</div>
            <div class={css({ color: "rgba(245, 240, 232, 0.58)", fontFamily: "mono", fontSize: "xs", letterSpacing: "0.14em", textTransform: "uppercase" })}>
              Ingested
            </div>
          </div>
          <div>
            <div class={css({ color: "zodiac.violet", fontSize: "3xl" })}>{counts()?.textReady ?? 0}</div>
            <div class={css({ color: "rgba(245, 240, 232, 0.58)", fontFamily: "mono", fontSize: "xs", letterSpacing: "0.14em", textTransform: "uppercase" })}>
              Text Ready
            </div>
          </div>
          <div>
            <div class={css({ color: "zodiac.cream", fontSize: "3xl" })}>{counts()?.reviewNeeded ?? 0}</div>
            <div class={css({ color: "rgba(245, 240, 232, 0.58)", fontFamily: "mono", fontSize: "xs", letterSpacing: "0.14em", textTransform: "uppercase" })}>
              Review Needed
            </div>
          </div>
          <div>
            <div class={css({ color: "#f87171", fontSize: "3xl" })}>{counts()?.blocked ?? 0}</div>
            <div class={css({ color: "rgba(245, 240, 232, 0.58)", fontFamily: "mono", fontSize: "xs", letterSpacing: "0.14em", textTransform: "uppercase" })}>
              Blocked
            </div>
          </div>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Action Queue</h2>

        <Show when={!inboxRows.isLoading()} fallback={<p>Loading inbox…</p>}>
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={inboxRows.data() ?? []}>
              {(row: any) => (
                <div
                  data-testid="display-row"
                  class={css({ borderColor: "rgba(200, 168, 75, 0.24)", borderRadius: "l2", borderWidth: "1px", p: "4" })}
                >
                  <div class={css({ alignItems: "center", display: "flex", gap: "2", marginBottom: "2" })}>
                    <UIBadge tone={statusTone(row.status)}>{row.status}</UIBadge>
                    <UIBadge tone="cream">{row.type}</UIBadge>
                    <Show when={row.blockedReason}>
                      <UIBadge tone="violet">blocked: {row.blockedReason}</UIBadge>
                    </Show>
                  </div>

                  <h3 class={css({ fontSize: "xl", marginBottom: "1" })}>{row.title ?? "Untitled source"}</h3>
                  <p class={css({ color: "rgba(245, 240, 232, 0.66)", fontSize: "sm", marginBottom: "2" })}>
                    Next action: <strong>{row.nextAction}</strong>
                  </p>

                  <Show when={row.extractionPreview}>
                    <p class={css({ color: "rgba(245, 240, 232, 0.56)", fontSize: "sm", marginBottom: "2" })}>
                      {row.extractionPreview.summary}
                    </p>
                  </Show>

                  <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
                    <UIButton
                      variant="outline"
                      disabled={row.status !== "text_ready"}
                      onClick={() => runRowExtraction(String(row._id))}
                    >
                      Run Extraction
                    </UIButton>
                    <UIButton variant="outline" onClick={() => markTriaged(String(row._id))}>
                      Mark Triaged
                    </UIButton>
                    <UIButton variant="ghost" onClick={() => promoteFollowers(String(row._id))}>
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
